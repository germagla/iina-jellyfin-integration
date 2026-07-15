import {
  BaseItemSchema,
  BridgeRequestSchema,
  ItemsResultSchema,
  PlaybackRequestSchema,
  parseBridgeResult,
  type AuthenticatedApiContext,
  type BridgeError,
  type BridgeOperation,
  type BridgeRequest,
  type BridgeResponse,
  type ConnectionMetadata,
  type PlaybackRequest,
} from '@iina-jellyfin/core';
import { ArtworkCache } from './artwork-cache';
import {
  BRIDGE_REQUEST_MESSAGE,
  BRIDGE_RESPONSE_MESSAGE,
  MANAGED_PLAYER_LABEL,
  PLAYER_MESSAGES,
  PLUGIN_PLAYBACK_SCHEME,
  PLUGIN_VERSION,
} from './constants';
import { createOpaqueId } from './ids';
import { IinaHttpTransport, JellyfinHttpError } from './iina-http';
import { JellyfinClient, type QuickConnectAttempt } from './jellyfin-client';
import { ConnectionStore } from './persistence';
import {
  displayMetadataFromItem,
  publicPlaybackResult,
  type PlayerLaunch,
} from './player-messages';
import { SafeLogger } from './safe-logger';

const api = iina;
const logger = new SafeLogger({
  log: (message) => api.console.log(message),
  warn: (message) => api.console.warn(message),
  error: (message) => api.console.error(message),
});
const transport = new IinaHttpTransport(api.http);
const connectionStore = new ConnectionStore(api.preferences, api.utils);
const client = new JellyfinClient(transport, {
  deviceId: connectionStore.getDeviceId(),
  version: PLUGIN_VERSION,
});
const artworkCache = new ArtworkCache(
  api.file,
  transport,
  Number(api.preferences.get('artworkCacheMaxBytes')) || 50 * 1024 * 1024,
);

let quickConnectAttempt: QuickConnectAttempt | undefined;
let quickConnectGeneration = 0;
let connectionGeneration = 0;
let managedPlayerId: number | undefined;
let managedPlayerReference: string | undefined;
let managedPlaybackSequence = 0;
interface PendingLaunch {
  launch: PlayerLaunch;
  createdAt: number;
  generation: number;
  managed: boolean;
  createdPlayer: boolean;
  playerId?: number;
  managedSequence?: number;
}
interface CatalogPlaybackState {
  generation: number;
  started: boolean;
  terminal: boolean;
  itemId?: string;
}
interface CatalogPlaybackConfirmation {
  itemId: string;
  plan: ReturnType<typeof publicPlaybackResult>;
  openInNewWindow: boolean;
  connectionGeneration: number;
  managedSequence?: number;
}
const pendingLaunches = new Map<string, PendingLaunch>();
const createdPlayerIds = new Set<number>();
const playerReferences = new Set<string>();
const playerIdByReference = new Map<string, number>();
const completedGenerations = new Set<string>();
const catalogPlaybackStates = new Map<string, CatalogPlaybackState>();
const catalogInvalidationKeys = new Set<string>();
const closedGenerations = new Set<string>();
let pendingCatalogConfirmation: CatalogPlaybackConfirmation | undefined;
const PENDING_LAUNCH_TTL_MS = 30_000;
const DEDUPE_RETENTION_MS = 60_000;

function staleRequest(): Error & { code: string } {
  const error = new Error('The connection changed before this request completed.') as Error & {
    code: string;
  };
  error.code = 'STALE_CONNECTION';
  return error;
}

function assertConnectionGeneration(generation: number): void {
  if (generation !== connectionGeneration) throw staleRequest();
}

function stalePlaybackRequest(): Error & { code: string } {
  const error = new Error('A newer playback request replaced this one.') as Error & {
    code: string;
  };
  error.code = 'STALE_PLAYBACK_REQUEST';
  return error;
}

function assertManagedPlaybackSequence(sequence: number | undefined): void {
  if (sequence !== undefined && sequence !== managedPlaybackSequence) {
    throw stalePlaybackRequest();
  }
}

function playerHasReference(playerId: number): boolean {
  for (const referencedId of playerIdByReference.values()) {
    if (referencedId === playerId) return true;
  }
  return false;
}

function prunePendingLaunches(): void {
  const cutoff = Date.now() - PENDING_LAUNCH_TTL_MS;
  const possiblyOrphanedPlayers = new Set<number>();
  for (const [nonce, pending] of pendingLaunches) {
    const superseded = pending.managed && pending.managedSequence !== managedPlaybackSequence;
    if (pending.createdAt <= cutoff || pending.generation !== connectionGeneration || superseded) {
      pendingLaunches.delete(nonce);
      if (pending.createdPlayer && pending.playerId !== undefined) {
        possiblyOrphanedPlayers.add(pending.playerId);
      }
    }
  }
  for (const playerId of possiblyOrphanedPlayers) {
    const stillPending = [...pendingLaunches.values()].some(
      (pending) => pending.playerId === playerId,
    );
    if (stillPending || playerHasReference(playerId)) continue;
    api.global.postMessage(playerId, PLAYER_MESSAGES.stop, { reason: 'closed' });
    createdPlayerIds.delete(playerId);
    if (managedPlayerId === playerId) {
      managedPlayerId = undefined;
      managedPlayerReference = undefined;
    }
  }
}

function registerPendingLaunch(nonce: string, pending: PendingLaunch): void {
  pendingLaunches.set(nonce, pending);
  setTimeout(() => {
    if (pendingLaunches.get(nonce) === pending) prunePendingLaunches();
  }, PENDING_LAUNCH_TTL_MS + 100);
}

function discardPendingLaunchesForPlayer(playerId: number): void {
  for (const [nonce, pending] of pendingLaunches) {
    if (pending.playerId === playerId) pendingLaunches.delete(nonce);
  }
}

function invalidateCatalogOnce(
  player: string,
  generation: number,
  transition: 'started' | 'ended',
  reason: string,
  state: Record<string, unknown>,
): void {
  const key = `${player}:${generation}:${transition}`;
  if (catalogInvalidationKeys.has(key)) return;
  catalogInvalidationKeys.add(key);
  api.standaloneWindow.postMessage('catalog.invalidated', { reason, state });
}

function releasePlayerDedupeState(player: string): void {
  setTimeout(() => {
    for (const key of catalogInvalidationKeys) {
      if (key.startsWith(`${player}:`)) catalogInvalidationKeys.delete(key);
    }
    for (const key of completedGenerations) {
      if (key.startsWith(`${player}:`)) completedGenerations.delete(key);
    }
    for (const key of closedGenerations) {
      if (key.startsWith(`${player}:`)) closedGenerations.delete(key);
    }
  }, DEDUPE_RETENTION_MS);
}

function stopAndForgetPlayers(reason: 'closed' | 'replaced' | 'user'): void {
  managedPlaybackSequence += 1;
  for (const playerId of createdPlayerIds) {
    api.global.postMessage(playerId, PLAYER_MESSAGES.stop, { reason });
  }
  createdPlayerIds.clear();
  playerReferences.clear();
  playerIdByReference.clear();
  catalogPlaybackStates.clear();
  completedGenerations.clear();
  catalogInvalidationKeys.clear();
  closedGenerations.clear();
  pendingCatalogConfirmation = undefined;
  managedPlayerId = undefined;
  managedPlayerReference = undefined;
}

function beginAuthenticationAttempt(): number {
  connectionGeneration += 1;
  connectionStore.clear();
  quickConnectAttempt = undefined;
  quickConnectGeneration = connectionGeneration;
  pendingLaunches.clear();
  pendingCatalogConfirmation = undefined;
  stopAndForgetPlayers('closed');
  return connectionGeneration;
}

function publicConnection(metadata: ConnectionMetadata | undefined) {
  if (metadata === undefined) return undefined;
  return {
    serverUrl: metadata.serverUrl,
    serverId: metadata.serverId,
    serverName: metadata.serverName,
    userId: metadata.userId,
    username: metadata.username,
    transport: metadata.serverUrl.startsWith('https:') ? 'https' : 'http',
    lastConnectedAt: metadata.lastConnectedAt,
  };
}

function authenticatedContext(): AuthenticatedApiContext {
  const metadata = connectionStore.readMetadata();
  if (metadata === undefined) throw new Error('Connect to Jellyfin before browsing your library.');
  const accessToken = connectionStore.readAccessToken(metadata);
  if (accessToken === undefined)
    throw new Error('The Jellyfin session is missing. Please reconnect.');
  return {
    serverUrl: metadata.serverUrl,
    userId: metadata.userId,
    accessToken,
    deviceId: metadata.deviceId,
    version: PLUGIN_VERSION,
  };
}

function bridgeError(error: unknown): BridgeError {
  if (error instanceof JellyfinHttpError) {
    return {
      code: error.statusCode === 401 || error.statusCode === 403 ? 'AUTH_EXPIRED' : 'NETWORK_ERROR',
      message: error.message,
      recoverable: error.recoverable,
    };
  }
  if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
    return { code, message: error.message, recoverable: true };
  }
  if (error !== null && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown; recoverable?: unknown };
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        code: candidate.code,
        message: candidate.message,
        recoverable: candidate.recoverable !== false,
      };
    }
  }
  return {
    code: 'REQUEST_FAILED',
    message: 'The request could not be completed.',
    recoverable: true,
  };
}

function respond<T>(request: Pick<BridgeRequest, 'operation' | 'requestId'>, result: T): void {
  const safeResult = parseBridgeResult(request.operation, result);
  const response: BridgeResponse<T> = {
    operation: request.operation,
    requestId: request.requestId,
    ok: true,
    result: safeResult as T,
  };
  api.standaloneWindow.postMessage(BRIDGE_RESPONSE_MESSAGE, response);
}

function respondError(
  request: { operation: BridgeOperation; requestId: string },
  error: unknown,
): void {
  const response: BridgeResponse = {
    operation: request.operation,
    requestId: request.requestId,
    ok: false,
    error: bridgeError(error),
  };
  api.standaloneWindow.postMessage(BRIDGE_RESPONSE_MESSAGE, response);
}

async function prepareLaunch(request: PlaybackRequest): Promise<{
  launch: PlayerLaunch;
  publicPlan: ReturnType<typeof publicPlaybackResult>;
}> {
  const generation = connectionGeneration;
  const context = authenticatedContext();
  const [plan, details] = await Promise.all([
    client.createPlaybackPlan(request, context),
    client.queryCatalog({ kind: 'details', itemId: request.itemId }, context),
  ]);
  assertConnectionGeneration(generation);
  const nonce = createOpaqueId('play');
  const launch: PlayerLaunch = {
    nonce,
    plan,
    context,
    display: displayMetadataFromItem(BaseItemSchema.parse(details)),
  };
  return { launch, publicPlan: publicPlaybackResult(plan) };
}

async function launchPlayback(request: PlaybackRequest): Promise<unknown> {
  pendingCatalogConfirmation = undefined;
  const managedSequence = request.openInNewWindow ? undefined : ++managedPlaybackSequence;
  const { launch, publicPlan } = await prepareLaunch(request);
  assertManagedPlaybackSequence(managedSequence);
  if (launch.plan.requiresVideoTranscodeConfirmation && !request.videoTranscodeApproved) {
    return { status: 'confirmation-required', plan: publicPlan };
  }

  const nonce = launch.nonce;
  prunePendingLaunches();
  const pending: PendingLaunch = {
    launch,
    createdAt: Date.now(),
    generation: connectionGeneration,
    managed: !request.openInNewWindow,
    createdPlayer: false,
  };
  if (managedSequence !== undefined) pending.managedSequence = managedSequence;
  registerPendingLaunch(nonce, pending);

  if (!request.openInNewWindow && managedPlayerId !== undefined) {
    pending.playerId = managedPlayerId;
    try {
      api.global.postMessage(managedPlayerId, PLAYER_MESSAGES.replace, { nonce });
    } catch (error) {
      pendingLaunches.delete(nonce);
      throw error;
    }
  } else {
    const label = request.openInNewWindow ? `jellyfin-player-${nonce}` : MANAGED_PLAYER_LABEL;
    let playerId: number;
    try {
      playerId = api.global.createPlayerInstance({
        label,
        url: `${PLUGIN_PLAYBACK_SCHEME}//play/${encodeURIComponent(nonce)}`,
        enablePlugins: false,
      });
    } catch (error) {
      pendingLaunches.delete(nonce);
      throw error;
    }
    pending.playerId = playerId;
    pending.createdPlayer = true;
    createdPlayerIds.add(playerId);
    if (!request.openInNewWindow) {
      managedPlayerId = playerId;
      managedPlayerReference = undefined;
    }
  }
  return { status: 'started', plan: publicPlan };
}

async function handleBridgeRequest(raw: unknown): Promise<void> {
  let request: BridgeRequest;
  try {
    request = BridgeRequestSchema.parse(raw);
  } catch {
    // Invalid messages are intentionally not reflected with their untrusted payload.
    const operation: BridgeOperation = 'catalog.refresh';
    respondError(
      { operation, requestId: createOpaqueId('invalid') },
      {
        code: 'INVALID_BRIDGE_MESSAGE',
        message: 'The catalog sent an invalid request.',
      },
    );
    return;
  }

  try {
    switch (request.operation) {
      case 'connection.probe': {
        const result = await client.probe(
          request.payload.serverUrl,
          request.payload.allowInsecureRemote,
        );
        respond(request, {
          server: result.server,
          normalizedUrl: result.address.url,
          transportPolicy: result.address.policy,
          isLocal: result.address.isLocal,
        });
        return;
      }
      case 'connection.login.password': {
        const generation = beginAuthenticationAttempt();
        const authenticated = await client.loginWithPassword(request.payload);
        assertConnectionGeneration(generation);
        connectionStore.save(authenticated.metadata, authenticated.accessToken);
        respond(request, { connection: publicConnection(authenticated.metadata) });
        return;
      }
      case 'connection.quickConnect.start': {
        const generation = beginAuthenticationAttempt();
        const attempt = await client.startQuickConnect(request.payload);
        assertConnectionGeneration(generation);
        quickConnectAttempt = attempt;
        quickConnectGeneration = generation;
        respond(request, {
          code: attempt.code,
          serverName: attempt.server.ServerName,
          expiresInSeconds: 600,
        });
        return;
      }
      case 'connection.quickConnect.poll': {
        if (quickConnectAttempt === undefined) throw new Error('Start Quick Connect first.');
        const attempt = quickConnectAttempt;
        const generation = quickConnectGeneration;
        const result = await client.pollQuickConnect(attempt);
        assertConnectionGeneration(generation);
        if (quickConnectAttempt !== attempt) throw staleRequest();
        if (!result.authenticated) {
          respond(request, { authenticated: false });
          return;
        }
        connectionStore.save(result.metadata, result.accessToken);
        quickConnectAttempt = undefined;
        respond(request, {
          authenticated: true,
          connection: publicConnection(result.metadata),
        });
        return;
      }
      case 'connection.disconnect':
        connectionGeneration += 1;
        connectionStore.clear();
        quickConnectAttempt = undefined;
        quickConnectGeneration = connectionGeneration;
        pendingLaunches.clear();
        pendingCatalogConfirmation = undefined;
        completedGenerations.clear();
        stopAndForgetPlayers('closed');
        respond(request, { disconnected: true });
        return;
      case 'catalog.query': {
        const generation = connectionGeneration;
        const result = await client.queryCatalog(request.payload, authenticatedContext());
        assertConnectionGeneration(generation);
        respond(request, result);
        return;
      }
      case 'artwork.fetch': {
        const generation = connectionGeneration;
        const dataUrl = await artworkCache.fetchDataUrl(request.payload, authenticatedContext());
        assertConnectionGeneration(generation);
        respond(request, {
          dataUrl,
        });
        return;
      }
      case 'playback.start':
        respond(request, await launchPlayback(request.payload));
        return;
      case 'playback.stop':
        managedPlaybackSequence += 1;
        prunePendingLaunches();
        if (managedPlayerId !== undefined) {
          api.global.postMessage(managedPlayerId, PLAYER_MESSAGES.stop, {
            reason: request.payload.reason,
          });
        }
        respond(request, { stopped: true });
        return;
      case 'catalog.refresh':
        respond(request, {
          connection: publicConnection(connectionStore.readMetadata()),
          refreshedAt: new Date().toISOString(),
        });
        return;
    }
  } catch (error) {
    logger.warn(`Bridge operation ${request.operation} failed`, error);
    respondError(request, error);
  }
}

const PLAYER_STATUSES = new Set(['idle', 'preparing', 'playing', 'paused', 'stopped', 'error']);

interface PublicPlayerState {
  generation: number;
  status: string;
  itemId?: string;
  stopReason?: string;
}

function parsePublicPlayerState(raw: unknown): PublicPlayerState | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.generation !== 'number' ||
    !Number.isInteger(candidate.generation) ||
    candidate.generation < 0 ||
    typeof candidate.status !== 'string' ||
    !PLAYER_STATUSES.has(candidate.status)
  ) {
    return undefined;
  }
  const state: PublicPlayerState = {
    generation: candidate.generation,
    status: candidate.status,
  };
  if (
    typeof candidate.itemId === 'string' &&
    candidate.itemId.length >= 1 &&
    candidate.itemId.length <= 512
  ) {
    state.itemId = candidate.itemId;
  }
  if (typeof candidate.stopReason === 'string' && candidate.stopReason.length <= 64) {
    state.stopReason = candidate.stopReason;
  }
  return state;
}

function publicCatalogState(state: PublicPlayerState): Record<string, unknown> {
  const result: Record<string, unknown> = {
    generation: state.generation,
    status: state.status,
  };
  if (state.itemId !== undefined) result.itemId = state.itemId;
  if (state.stopReason !== undefined) result.stopReason = state.stopReason;
  return result;
}

async function sendSeriesCorrectUpNext(
  player: string,
  generation: number,
  completedItemId: string,
): Promise<void> {
  const requestConnectionGeneration = connectionGeneration;
  const context = authenticatedContext();
  const completedItem = BaseItemSchema.parse(
    await client.queryCatalog({ kind: 'details', itemId: completedItemId }, context),
  );
  assertConnectionGeneration(requestConnectionGeneration);
  if (completedItem.Type !== 'Episode' || completedItem.SeriesId == null) return;

  const nextUp = ItemsResultSchema.parse(
    await client.queryCatalog(
      {
        kind: 'home',
        shelf: 'nextUp',
        limit: 1,
        seriesId: completedItem.SeriesId,
      },
      context,
    ),
  );
  assertConnectionGeneration(requestConnectionGeneration);
  const next = nextUp.Items.find(
    (item) => item.SeriesId === completedItem.SeriesId && item.Id !== completedItem.Id,
  );
  if (next === undefined) return;

  const currentState = catalogPlaybackStates.get(player);
  const completionKey = `${player}:${generation}`;
  if (
    currentState?.generation !== generation ||
    !currentState.terminal ||
    !completedGenerations.has(completionKey) ||
    !playerReferences.has(player)
  ) {
    return;
  }
  api.global.postMessage(player, PLAYER_MESSAGES.upNext, {
    item: next,
    countdownSeconds: 10,
    autoplay: api.preferences.get('autoplayNextEpisode') !== false,
  });
}

function openCatalog(): void {
  api.standaloneWindow.open();
  setTimeout(() => {
    api.standaloneWindow.postMessage('catalog.visible', {
      connection: publicConnection(connectionStore.readMetadata()),
    });
    const confirmation = pendingCatalogConfirmation;
    if (confirmation === undefined) return;
    if (
      confirmation.connectionGeneration !== connectionGeneration ||
      (confirmation.managedSequence !== undefined &&
        confirmation.managedSequence !== managedPlaybackSequence)
    ) {
      pendingCatalogConfirmation = undefined;
      return;
    }
    api.standaloneWindow.postMessage('playback.confirmation-required', {
      itemId: confirmation.itemId,
      plan: confirmation.plan,
      source: 'up-next',
      openInNewWindow: confirmation.openInNewWindow,
    });
  }, 50);
}

api.standaloneWindow.loadFile('dist/ui/catalog/index.html');
api.standaloneWindow.setProperty({
  title: 'Jellyfin for IINA',
  resizable: true,
  fullSizeContentView: true,
  hideTitleBar: false,
});
api.standaloneWindow.setFrame(1_200, 820, null, null);
api.standaloneWindow.onMessage(BRIDGE_REQUEST_MESSAGE, (data) => {
  void handleBridgeRequest(data);
});

api.menu.addItem(api.menu.item('Open Jellyfin Library', openCatalog));

api.global.onMessage(PLAYER_MESSAGES.planRequest, (data, player) => {
  const record = data as { nonce?: unknown };
  if (typeof record.nonce !== 'string' || player === undefined) return;
  prunePendingLaunches();
  const pending = pendingLaunches.get(record.nonce);
  if (
    pending === undefined ||
    pending.generation !== connectionGeneration ||
    (pending.managed && pending.managedSequence !== managedPlaybackSequence)
  ) {
    pendingLaunches.delete(record.nonce);
    return;
  }
  playerReferences.add(player);
  if (pending.playerId !== undefined) playerIdByReference.set(player, pending.playerId);
  if (pending.managed) managedPlayerReference = player;
  api.global.postMessage(player, PLAYER_MESSAGES.plan, pending.launch);
  pendingLaunches.delete(record.nonce);
});

api.global.onMessage(PLAYER_MESSAGES.closed, (data, player) => {
  if (player !== undefined) {
    const playerId = playerIdByReference.get(player);
    const catalogState = catalogPlaybackStates.get(player);
    const reportedGeneration = (data as { generation?: unknown }).generation;
    const generation =
      typeof reportedGeneration === 'number' &&
      Number.isInteger(reportedGeneration) &&
      reportedGeneration >= 0
        ? reportedGeneration
        : catalogState?.generation;
    if (generation !== undefined) {
      closedGenerations.add(`${player}:${generation}`);
      if (catalogState?.started === true && !catalogState.terminal) {
        invalidateCatalogOnce(player, generation, 'ended', 'player-closed', {
          generation,
          status: 'stopped',
          stopReason: 'closed',
        });
      }
    }
    catalogPlaybackStates.delete(player);
    if (playerId !== undefined) {
      discardPendingLaunchesForPlayer(playerId);
      createdPlayerIds.delete(playerId);
    }
    playerReferences.delete(player);
    playerIdByReference.delete(player);
    if (player === managedPlayerReference) {
      managedPlaybackSequence += 1;
      managedPlayerId = undefined;
      managedPlayerReference = undefined;
    }
    releasePlayerDedupeState(player);
  }
});

api.global.onMessage(PLAYER_MESSAGES.state, (data, player) => {
  if (player === undefined) return;
  const state = parsePublicPlayerState(data);
  if (state === undefined) return;
  const terminal = state.status === 'stopped' || state.status === 'error';
  const closed = closedGenerations.has(`${player}:${state.generation}`);
  if (!playerReferences.has(player) && !closed) return;
  if (closed) {
    if (terminal) {
      invalidateCatalogOnce(
        player,
        state.generation,
        'ended',
        'playback-ended',
        publicCatalogState(state),
      );
    }
    return;
  }

  let catalogState = catalogPlaybackStates.get(player);
  if (catalogState === undefined || catalogState.generation !== state.generation) {
    catalogState = {
      generation: state.generation,
      started: false,
      terminal: false,
    };
    catalogPlaybackStates.set(player, catalogState);
  }
  if (state.itemId !== undefined) catalogState.itemId = state.itemId;
  if (state.status === 'playing') {
    catalogState.started = true;
    invalidateCatalogOnce(
      player,
      state.generation,
      'started',
      'playback-started',
      publicCatalogState(state),
    );
  }
  if (terminal) {
    catalogState.terminal = true;
    invalidateCatalogOnce(
      player,
      state.generation,
      'ended',
      'playback-ended',
      publicCatalogState(state),
    );
  }

  if (state.stopReason !== 'completed' || catalogState.itemId === undefined) return;
  const completionKey = `${player}:${state.generation}`;
  if (completedGenerations.has(completionKey)) return;
  completedGenerations.add(completionKey);
  void sendSeriesCorrectUpNext(player, state.generation, catalogState.itemId).catch((error) =>
    logger.warn('Could not prepare Up Next', error),
  );
});

api.global.onMessage(PLAYER_MESSAGES.playNext, (data, player) => {
  const itemId = (data as { itemId?: unknown }).itemId;
  if (player === undefined || typeof itemId !== 'string') return;
  void (async () => {
    const managed = player === managedPlayerReference;
    const managedSequence = managed ? ++managedPlaybackSequence : undefined;
    try {
      const request = PlaybackRequestSchema.parse({ itemId });
      const { launch, publicPlan } = await prepareLaunch(request);
      assertManagedPlaybackSequence(managedSequence);
      pendingCatalogConfirmation = undefined;
      if (launch.plan.requiresVideoTranscodeConfirmation) {
        // Autoplay never starts a video re-encode without a catalog confirmation.
        pendingCatalogConfirmation = {
          itemId,
          plan: publicPlan,
          openInNewWindow: !managed,
          connectionGeneration,
        };
        if (managedSequence !== undefined) {
          pendingCatalogConfirmation.managedSequence = managedSequence;
        }
        openCatalog();
        return;
      }
      prunePendingLaunches();
      const pending: PendingLaunch = {
        launch,
        createdAt: Date.now(),
        generation: connectionGeneration,
        managed,
        createdPlayer: false,
      };
      if (managedSequence !== undefined) pending.managedSequence = managedSequence;
      const playerId = playerIdByReference.get(player);
      if (playerId !== undefined) pending.playerId = playerId;
      registerPendingLaunch(launch.nonce, pending);
      try {
        api.global.postMessage(player, PLAYER_MESSAGES.replace, { nonce: launch.nonce });
      } catch (error) {
        pendingLaunches.delete(launch.nonce);
        throw error;
      }
    } catch (error) {
      logger.warn('Could not start Up Next', error);
    }
  })();
});

api.global.onMessage(PLAYER_MESSAGES.catalogOpen, () => openCatalog());

logger.info('Global Jellyfin integration ready');
