import { ConnectionMetadataSchema, type ConnectionMetadata } from './contracts';

export interface PreferenceStore {
  get(key: string): unknown | Promise<unknown>;
  set(key: string, value: unknown): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}

export interface SecretStore {
  get(account: string): string | undefined | Promise<string | undefined>;
  set(account: string, secret: string): void | Promise<void>;
  delete(account: string): void | Promise<void>;
}

export interface AuthenticatedConnection {
  metadata: ConnectionMetadata;
  accessToken: string;
}

export const CONNECTION_METADATA_PREFERENCE_KEY = 'jellyfin.connection.v1';
const TOKEN_ACCOUNT_PREFIX = 'jellyfin-access-token';

export function accessTokenAccount(
  metadata: Pick<ConnectionMetadata, 'serverId' | 'userId'>,
): string {
  return `${TOKEN_ACCOUNT_PREFIX}:${metadata.serverId}:${metadata.userId}`;
}

export class ConnectionPersistence {
  constructor(
    private readonly preferences: PreferenceStore,
    private readonly secrets: SecretStore,
  ) {}

  async loadMetadata(): Promise<ConnectionMetadata | undefined> {
    const raw = await this.preferences.get(CONNECTION_METADATA_PREFERENCE_KEY);
    if (raw === undefined || raw === null) return undefined;
    const result = ConnectionMetadataSchema.safeParse(raw);
    return result.success ? result.data : undefined;
  }

  async loadAuthenticated(): Promise<AuthenticatedConnection | undefined> {
    const metadata = await this.loadMetadata();
    if (metadata === undefined) return undefined;
    const accessToken = await this.secrets.get(accessTokenAccount(metadata));
    if (accessToken === undefined || accessToken === '') return undefined;
    return { metadata, accessToken };
  }

  async save(metadataInput: ConnectionMetadata, accessToken: string): Promise<void> {
    const metadata = ConnectionMetadataSchema.parse(metadataInput);
    if (accessToken.length === 0) throw new TypeError('The access token cannot be empty');

    const previousMetadata = await this.loadMetadata();
    const account = accessTokenAccount(metadata);
    const previousToken = await this.secrets.get(account);
    await this.secrets.set(account, accessToken);
    try {
      // Strict schema parsing above is the runtime boundary that prevents an
      // accidental accessToken/password property from reaching preferences.
      await this.preferences.set(CONNECTION_METADATA_PREFERENCE_KEY, metadata);
    } catch (error) {
      if (previousToken === undefined) await this.secrets.delete(account);
      else await this.secrets.set(account, previousToken);
      throw error;
    }

    if (previousMetadata !== undefined) {
      const previousAccount = accessTokenAccount(previousMetadata);
      if (previousAccount !== account) await this.secrets.delete(previousAccount);
    }
  }

  async clear(): Promise<void> {
    const metadata = await this.loadMetadata();
    if (metadata !== undefined) await this.secrets.delete(accessTokenAccount(metadata));
    await this.preferences.delete(CONNECTION_METADATA_PREFERENCE_KEY);
  }
}
