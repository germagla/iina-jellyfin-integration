import { ConnectionMetadataSchema, type ConnectionMetadata } from '@iina-jellyfin/core';
import { CONNECTION_PREFERENCE_KEY, DEVICE_ID_PREFERENCE_KEY, KEYCHAIN_SERVICE } from './constants';
import { createStableDeviceId } from './ids';

export interface PreferenceApi {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  sync(): void;
}

export interface KeychainApi {
  keyChainRead(service: string, name: string): string | false;
  keyChainWrite(service: string, name: string, password: string): boolean;
}

interface CredentialEnvelope {
  version: 1;
  serverUrl: string;
  serverId: string;
  userId: string;
  accessToken: string;
}

export function keychainAccount(metadata: Pick<ConnectionMetadata, 'serverId' | 'userId'>): string {
  return `${metadata.serverId}:${metadata.userId}`;
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
    const value = this.keychain.keyChainRead(KEYCHAIN_SERVICE, keychainAccount(metadata));
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
    const previousMetadata = this.readMetadata();
    const account = keychainAccount(validated);
    const previousCredential = this.keychain.keyChainRead(KEYCHAIN_SERVICE, account);
    const previousAccount =
      previousMetadata === undefined ? undefined : keychainAccount(previousMetadata);
    const previousAccountCredential =
      previousAccount === undefined || previousAccount === account
        ? false
        : this.keychain.keyChainRead(KEYCHAIN_SERVICE, previousAccount);
    const envelope: CredentialEnvelope = {
      version: 1,
      serverUrl: validated.serverUrl,
      serverId: validated.serverId,
      userId: validated.userId,
      accessToken,
    };
    if (!this.keychain.keyChainWrite(KEYCHAIN_SERVICE, account, JSON.stringify(envelope))) {
      throw new Error('macOS Keychain did not accept the Jellyfin access token.');
    }

    let previousAccountCleared = false;
    if (
      previousAccount !== undefined &&
      previousAccount !== account &&
      typeof previousAccountCredential === 'string' &&
      previousAccountCredential.length > 0
    ) {
      if (!this.keychain.keyChainWrite(KEYCHAIN_SERVICE, previousAccount, '')) {
        this.keychain.keyChainWrite(
          KEYCHAIN_SERVICE,
          account,
          typeof previousCredential === 'string' ? previousCredential : '',
        );
        throw new Error('macOS Keychain did not remove the previous Jellyfin access token.');
      }
      previousAccountCleared = true;
    }

    const previousPreference = this.preferences.get(CONNECTION_PREFERENCE_KEY);
    try {
      this.preferences.set(CONNECTION_PREFERENCE_KEY, JSON.stringify(validated));
      this.preferences.sync();
    } catch (error) {
      if (previousAccountCleared && previousAccount !== undefined) {
        this.keychain.keyChainWrite(
          KEYCHAIN_SERVICE,
          previousAccount,
          previousAccountCredential as string,
        );
      }
      this.keychain.keyChainWrite(
        KEYCHAIN_SERVICE,
        account,
        typeof previousCredential === 'string' ? previousCredential : '',
      );
      this.preferences.set(CONNECTION_PREFERENCE_KEY, previousPreference ?? '');
      this.preferences.sync();
      throw error;
    }
  }

  clear(): void {
    const metadata = this.readMetadata();
    if (metadata !== undefined) {
      // IINA 1.4 exposes no delete operation; an empty value makes the credential unusable.
      const account = keychainAccount(metadata);
      const credential = this.keychain.keyChainRead(KEYCHAIN_SERVICE, account);
      if (
        typeof credential === 'string' &&
        credential.length > 0 &&
        !this.keychain.keyChainWrite(KEYCHAIN_SERVICE, account, '')
      ) {
        throw new Error('macOS Keychain did not remove the Jellyfin access token.');
      }
    }
    this.preferences.set(CONNECTION_PREFERENCE_KEY, '');
    this.preferences.sync();
  }
}
