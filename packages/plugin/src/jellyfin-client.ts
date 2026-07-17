import {
  AuthenticationResultSchema,
  BaseItemSchema,
  ItemsResultSchema,
  PlaybackInfoResponseSchema,
  PublicSystemInfoSchema,
  buildCatalogRequest,
  buildPasswordAuthenticationRequest,
  buildPlaybackInfoRequest,
  buildPublicServerInfoRequest,
  buildQuickConnectAuthenticationRequest,
  buildQuickConnectInitiateRequest,
  buildQuickConnectStatusRequest,
  buildSessionLogoutRequest,
  normalizeServerUrl,
  selectPlaybackPlan,
  type AuthenticatedApiContext,
  type CatalogRequest,
  type ClientIdentity,
  type ConnectionMetadata,
  type PlaybackPlan,
  type PlaybackRequest,
  type PublicSystemInfo,
} from '@iina-jellyfin/core';
import type { IinaHttpTransport } from './iina-http';

interface QuickConnectStatusResponse {
  Authenticated: boolean;
  Secret?: string;
  Code?: string;
}

export interface QuickConnectAttempt {
  serverUrl: string;
  server: PublicSystemInfo;
  secret: string;
  code: string;
  allowInsecureRemote: boolean;
  startedAt: number;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Jellyfin response is missing ${key}.`);
  }
  return value;
}

function recordValue(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Jellyfin returned an unexpected response.');
  }
  return value as Record<string, unknown>;
}

export class JellyfinClient {
  constructor(
    private readonly transport: IinaHttpTransport,
    readonly identity: ClientIdentity,
  ) {}

  async probe(serverInput: string, allowInsecureRemote = false) {
    const address = normalizeServerUrl(serverInput, { allowInsecureRemote });
    const raw = await this.transport.execute(buildPublicServerInfoRequest(address.url));
    return { address, server: PublicSystemInfoSchema.parse(raw) };
  }

  async loginWithPassword(input: {
    serverUrl: string;
    username: string;
    password: string;
    allowInsecureRemote: boolean;
  }): Promise<{ metadata: ConnectionMetadata; accessToken: string }> {
    const { address, server } = await this.probe(input.serverUrl, input.allowInsecureRemote);
    const raw = await this.transport.execute(
      buildPasswordAuthenticationRequest(address.url, this.identity, {
        username: input.username,
        password: input.password,
      }),
    );
    const authentication = AuthenticationResultSchema.parse(raw);
    return {
      metadata: {
        schemaVersion: 1,
        serverUrl: address.url,
        serverId: authentication.ServerId || server.Id,
        serverName: server.ServerName,
        userId: authentication.User.Id,
        username: authentication.User.Name,
        deviceId: this.identity.deviceId,
        acceptedInsecureRemote:
          address.policy === 'remote-http-accepted' && input.allowInsecureRemote,
        lastConnectedAt: new Date().toISOString(),
      },
      accessToken: authentication.AccessToken,
    };
  }

  async startQuickConnect(input: {
    serverUrl: string;
    allowInsecureRemote: boolean;
  }): Promise<QuickConnectAttempt> {
    const { address, server } = await this.probe(input.serverUrl, input.allowInsecureRemote);
    const raw = recordValue(
      await this.transport.execute(buildQuickConnectInitiateRequest(address.url, this.identity)),
    );
    return {
      serverUrl: address.url,
      server,
      secret: requiredString(raw, 'Secret'),
      code: requiredString(raw, 'Code'),
      allowInsecureRemote: input.allowInsecureRemote,
      startedAt: Date.now(),
    };
  }

  async pollQuickConnect(
    attempt: QuickConnectAttempt,
  ): Promise<
    | { authenticated: false }
    | { authenticated: true; metadata: ConnectionMetadata; accessToken: string }
  > {
    if (Date.now() - attempt.startedAt > 10 * 60 * 1000) {
      throw new Error('The Quick Connect code expired. Start again for a new code.');
    }
    const statusRaw = recordValue(
      await this.transport.execute(
        buildQuickConnectStatusRequest(attempt.serverUrl, this.identity, attempt.secret),
      ),
    );
    const status: QuickConnectStatusResponse = {
      Authenticated: statusRaw.Authenticated === true,
    };
    if (!status.Authenticated) return { authenticated: false };

    const raw = await this.transport.execute(
      buildQuickConnectAuthenticationRequest(attempt.serverUrl, this.identity, attempt.secret),
    );
    const authentication = AuthenticationResultSchema.parse(raw);
    const address = normalizeServerUrl(attempt.serverUrl, {
      allowInsecureRemote: attempt.allowInsecureRemote,
    });
    return {
      authenticated: true,
      metadata: {
        schemaVersion: 1,
        serverUrl: attempt.serverUrl,
        serverId: authentication.ServerId || attempt.server.Id,
        serverName: attempt.server.ServerName,
        userId: authentication.User.Id,
        username: authentication.User.Name,
        deviceId: this.identity.deviceId,
        acceptedInsecureRemote:
          address.policy === 'remote-http-accepted' && attempt.allowInsecureRemote,
        lastConnectedAt: new Date().toISOString(),
      },
      accessToken: authentication.AccessToken,
    };
  }

  async reportSessionEnded(context: AuthenticatedApiContext): Promise<void> {
    await this.transport.execute(buildSessionLogoutRequest(context));
  }

  async queryCatalog(request: CatalogRequest, context: AuthenticatedApiContext): Promise<unknown> {
    const raw = await this.transport.execute(buildCatalogRequest(request, context));
    if (request.kind === 'details') return BaseItemSchema.parse(raw);
    if (request.kind === 'home' && request.shelf === 'recentlyAdded' && Array.isArray(raw)) {
      return raw.map((item) => BaseItemSchema.parse(item));
    }
    return ItemsResultSchema.parse(raw);
  }

  async createPlaybackPlan(
    request: PlaybackRequest,
    context: AuthenticatedApiContext,
  ): Promise<PlaybackPlan> {
    const response = PlaybackInfoResponseSchema.parse(
      await this.transport.execute(buildPlaybackInfoRequest(request, context)),
    );
    return selectPlaybackPlan(response, request, context);
  }
}
