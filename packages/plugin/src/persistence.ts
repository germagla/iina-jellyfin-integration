import { ConnectionMetadataSchema, type ConnectionMetadata } from '@iina-jellyfin/core';
import {
  CONNECTION_PREFERENCE_KEY,
  DEVICE_ID_PREFERENCE_KEY,
  KEYCHAIN_ACCOUNT,
  KEYCHAIN_SERVICE,
} from './constants';
import { createStableDeviceId } from './ids';

export interface PreferenceApi {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  sync(): void;
}

export interface KeychainApi {
  read(service: string, name: string): string | false;
  write(service: string, name: string, password: string): boolean;
}

interface CredentialEnvelope {
  version: 1;
  serverUrl: string;
  serverId: string;
  userId: string;
  accessToken: string;
}

export class ConnectionStore {
  constructor(
    private readonly preferences: PreferenceApi,
    private readonly keychain: KeychainApi,
  ) {}

  getDeviceId(): string {
    const current = this.preferences.get(DEVICE_ID_PREFERENCE_KEY);
    if (typeof current === 'string' && current.length >= 16) return current;
    const created = createStableDeviceId();
    this.preferences.set(DEVICE_ID_PREFERENCE_KEY, created);
    this.preferences.sync();
    return created;
  }

  readMetadata(): ConnectionMetadata | undefined {
    const value = this.preferences.get(CONNECTION_PREFERENCE_KEY);
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    try {
      return ConnectionMetadataSchema.parse(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  readAccessToken(metadata: ConnectionMetadata): string | undefined {
    const value = this.keychain.read(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    if (typeof value !== 'string' || value.length === 0) return undefined;
    try {
      const envelope = JSON.parse(value) as Partial<CredentialEnvelope>;
      return envelope.version === 1 &&
        envelope.serverUrl === metadata.serverUrl &&
        envelope.serverId === metadata.serverId &&
        envelope.userId === metadata.userId &&
        typeof envelope.accessToken === 'string' &&
        envelope.accessToken.length > 0
        ? envelope.accessToken
        : undefined;
    } catch {
      return undefined;
    }
  }

  save(metadata: ConnectionMetadata, accessToken: string): void {
    if (accessToken.length === 0) throw new TypeError('Access token cannot be empty');
    const validated = ConnectionMetadataSchema.parse(metadata);
    const previousCredential = this.keychain.read(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    const envelope: CredentialEnvelope = {
      version: 1,
      serverUrl: validated.serverUrl,
      serverId: validated.serverId,
      userId: validated.userId,
      accessToken,
    };
    if (!this.keychain.write(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, JSON.stringify(envelope))) {
      throw new Error('macOS Keychain did not accept the Jellyfin access token.');
    }

    const previousPreference = this.preferences.get(CONNECTION_PREFERENCE_KEY);
    try {
      this.preferences.set(CONNECTION_PREFERENCE_KEY, JSON.stringify(validated));
      this.preferences.sync();
    } catch (error) {
      let rollbackFailed = false;
      try {
        rollbackFailed = !this.keychain.write(
          KEYCHAIN_SERVICE,
          KEYCHAIN_ACCOUNT,
          typeof previousCredential === 'string' ? previousCredential : '',
        );
      } catch {
        rollbackFailed = true;
      }
      try {
        this.preferences.set(CONNECTION_PREFERENCE_KEY, previousPreference ?? '');
        this.preferences.sync();
      } catch {
        rollbackFailed = true;
      }
      if (rollbackFailed) {
        throw new Error(
          'The previous Jellyfin connection could not be restored safely. Please reconnect.',
        );
      }
      throw error;
    }
  }

  clear(): void {
    // IINA 1.4 exposes no delete operation. Always overwrite the single V1
    // credential so a failed read cannot leave a usable token behind.
    if (!this.keychain.write(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, '')) {
      throw new Error('macOS Keychain did not remove the Jellyfin access token.');
    }
    this.preferences.set(CONNECTION_PREFERENCE_KEY, '');
    this.preferences.sync();
  }
}
