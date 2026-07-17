import {
  BaseItemSchema,
  BridgeRequestSchema,
  CATALOG_DIAGNOSTIC_MESSAGE,
  CATALOG_READY_MESSAGE,
  parseBridgeResult,
  type AuthenticatedApiContext,
  type BridgeOperation,
  type BridgeRequest,
  type BridgeResponse,
  type AuthenticatedConnection,
  type ConnectionMetadata,
  type PlaybackRequest,
} from '@iina-jellyfin/core';
import { ArtworkCache } from './artwork-cache';
import { toBridgeError } from './bridge-error';
import { consumeCatalogOpenRequest } from './catalog-open-request';
import {
  BRIDGE_REQUEST_MESSAGE,
  BRIDGE_RESPONSE_MESSAGE,
  PLAYER_MESSAGES,
  PLUGIN_VERSION,
} from './constants';
import {
  createGlobalDiagnosticSink,
  parseCatalogDiagnosticRecord,
  PersistentDiagnosticLog,
} from './diagnostic-log';
import { consumeDiagnosticLogRevealRequest } from './diagnostic-log-request';
import { createOpaqueId } from './ids';
import { IinaHttpTransport } from './iina-http';
import { createIinaKeychainApi } from './iina-keychain';
import { createPlayerInstanceOnMainThread, runOnIinaMainThread } from './iina-main-thread';
import { JellyfinClient, type QuickConnectAttempt } from './jellyfin-client';
import { assertPlayableMediaItem } from './media-playability';
import { ConnectionStore } from './persistence';
import {
  displayMetadataFromItem,
  publicPlaybackResult,
  type PlayerLaunch,
} from './player-messages';
import { PlaybackConfirmationStore } from './playback-confirmations';
import { SafeLogger } from './safe-logger';

const api = iina;
const diagnosticLog = new PersistentDiagnosticLog(api.file, (message) => api.console.warn(message));
const logger = new SafeLogger(createGlobalDiagnosticSink(api.console, diagnosticLog));
const transport = new IinaHttpTransport(api.http);
const connectionStore = new ConnectionStore(api.preferences, createIinaKeychainApi(api.utils));
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
interface PreparedLaunch {
  launch: PlayerLaunch;
  publicPlan: ReturnType<typeof publicPlaybackResult>;
}
const pendingLaunches = new Map<string, PendingLaunch>();
const playbackConfirmations = new PlaybackConfirmationStore<PreparedLaunch>(
  Date.now,
  () => createOpaqueId('transcode-confirmation'),
  120_000,
  16,
  setTimeout,
);
const createdPlayerIds = new Set<number>();
const catalogDiagnosticFingerprints = new Set<string>();
let catalogReady = false;
let catalogOpenRequested = false;
const PENDING_LAUNCH_TTL_MS = 30_000;
const MAX_CATALOG_DIAGNOSTICS_PER_ENTRY = 32;
const SESSION_REVOCATION_GRACE_MS = 2_500;

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
    if (stillPending) continue;
    void postPlayerMessage(playerId, PLAYER_MESSAGES.stop, { reason: 'closed' }).catch((error) => {
      logger.warn('Could not stop an expired controlled player', error);
    });
    // IINA does not expose a way to destroy a controlled PlayerCore. `stop`
    // closes its window but leaves the numeric core available for a later
    // launch, so keep tracking it instead of creating an unreachable orphan.
  }
}

function postPlayerMessage(playerId: number, name: string, payload: unknown): Promise<void> {
  return runOnIinaMainThread(() => {
    api.global.postMessage(playerId, name, payload);
  });
}

function registerPendingLaunch(nonce: string, pending: PendingLaunch): void {
  pendingLaunches.set(nonce, pending);
  setTimeout(() => {
    if (pendingLaunches.get(nonce) === pending) prunePendingLaunches();
  }, PENDING_LAUNCH_TTL_MS + 100);
}

function stopTrackedPlayers(reason: 'closed' | 'replaced' | 'user'): void {
  managedPlaybackSequence += 1;
  for (const playerId of createdPlayerIds) {
    void postPlayerMessage(playerId, PLAYER_MESSAGES.stop, { reason }).catch((error) => {
      logger.warn('Could not stop a controlled Jellyfin player', error);
    });
  }
  playbackConfirmations.clear();
}

function beginAuthenticationAttempt(): number {
  connectionGeneration += 1;
  quickConnectAttempt = undefined;
  quickConnectGeneration = connectionGeneration;
  pendingLaunches.clear();
  playbackConfirmations.clear();
  stopTrackedPlayers('closed');
  return connectionGeneration;
}

async function acceptAuthenticatedConnection(
  authenticated: AuthenticatedConnection,
  validate: () => void,
): Promise<void> {
  let previousContext: AuthenticatedApiContext | undefined;
  try {
    validate();
    previousContext = storedAuthenticatedContext();
    connectionStore.save(authenticated.metadata, authenticated.accessToken);
  } catch (error) {
    if (!storedConnectionMatches(authenticated)) {
      await revokeSession(
        authenticatedContextFrom(authenticated),
        'Could not revoke a Jellyfin session after authentication was rejected',
      );
    }
    throw error;
  }

  if (
    previousContext !== undefined &&
    (previousContext.serverUrl !== authenticated.metadata.serverUrl ||
      previousContext.accessToken !== authenticated.accessToken)
  ) {
    void revokeSession(
      previousContext,
      'Could not revoke the previous Jellyfin session after connection replacement',
    );
  }
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

function authenticatedContextFrom(authenticated: AuthenticatedConnection): AuthenticatedApiContext {
  return {
    ...client.identity,
    serverUrl: authenticated.metadata.serverUrl,
    userId: authenticated.metadata.userId,
    accessToken: authenticated.accessToken,
  };
}

function storedAuthenticatedContext(): AuthenticatedApiContext | undefined {
  const metadata = connectionStore.readMetadata();
  if (metadata === undefined) return undefined;
  const accessToken = connectionStore.readAccessToken(metadata);
  if (accessToken === undefined) return undefined;
  return {
    serverUrl: metadata.serverUrl,
    userId: metadata.userId,
    accessToken,
    deviceId: metadata.deviceId,
    version: PLUGIN_VERSION,
  };
}

function storedConnectionMatches(authenticated: AuthenticatedConnection): boolean {
  try {
    const stored = storedAuthenticatedContext();
    return (
      stored?.serverUrl === authenticated.metadata.serverUrl &&
      stored.userId === authenticated.metadata.userId &&
      stored.accessToken === authenticated.accessToken
    );
  } catch {
    return false;
  }
}

async function revokeSession(context: AuthenticatedApiContext, warning: string): Promise<void> {
  try {
    await client.reportSessionEnded(context);
  } catch (error) {
    logger.warn(warning, error);
  }
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
    error: toBridgeError(error),
  };
  api.standaloneWindow.postMessage(BRIDGE_RESPONSE_MESSAGE, response);
}

async function prepareLaunch(request: PlaybackRequest): Promise<{
  launch: PlayerLaunch;
  publicPlan: ReturnType<typeof publicPlaybackResult>;
}> {
  const generation = connectionGeneration;
  const context = authenticatedContext();
  const details = BaseItemSchema.parse(
    await client.queryCatalog({ kind: 'details', itemId: request.itemId }, context),
  );
  assertPlayableMediaItem(details);
  assertConnectionGeneration(generation);
  const plan = await client.createPlaybackPlan(request, context);
  assertConnectionGeneration(generation);
  const nonce = createOpaqueId('play');
  const launch: PlayerLaunch = {
    nonce,
    plan,
    context,
    display: displayMetadataFromItem(details),
  };
  return { launch, publicPlan: publicPlaybackResult(plan) };
}

async function deliverPreparedLaunch(
  request: PlaybackRequest,
  prepared: PreparedLaunch,
  managedSequence: number | undefined,
): Promise<unknown> {
  const { launch, publicPlan } = prepared;
  const correlation = launch.diagnosticCorrelation ?? createOpaqueId('diagnostic-playback');
  assertManagedPlaybackSequence(managedSequence);

  if (!request.openInNewWindow && managedPlayerId !== undefined) {
    assertManagedPlaybackSequence(managedSequence);
    logger.info('native-player.reuse', { correlation });
    // The controlled main entry is already loaded. Deliver the complete trusted
    // launch directly by numeric handle; PlayerRuntime replaces active media via
    // mpv so IINA does not close and recreate the visible player window.
    const playerId = managedPlayerId;
    await runOnIinaMainThread(() => {
      assertManagedPlaybackSequence(managedSequence);
      api.global.postMessage(playerId, PLAYER_MESSAGES.launch, launch);
    });
    return { status: 'started', plan: publicPlan };
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

  let playerId: number;
  try {
    logger.info('native-player.create.scheduled', { correlation });
    playerId = await createPlayerInstanceOnMainThread(() => {
      assertConnectionGeneration(pending.generation);
      assertManagedPlaybackSequence(managedSequence);
      if (pendingLaunches.get(nonce) !== pending) throw stalePlaybackRequest();
      logger.info('native-player.create.begin', { correlation });
      return api.global.createPlayerInstance({
        label: nonce,
        enablePlugins: false,
      });
    });
  } catch (error) {
    if (pendingLaunches.get(nonce) === pending) pendingLaunches.delete(nonce);
    throw error;
  }
  logger.info('native-player.create.returned', { correlation });
  pending.playerId = playerId;
  pending.createdPlayer = true;
  createdPlayerIds.add(playerId);
  try {
    // A newer bridge request can start after the main-run-loop callback creates
    // the core but before this async continuation resumes. Retain the numeric
    // core for reuse, but never deliver the superseded launch to it.
    assertConnectionGeneration(pending.generation);
    assertManagedPlaybackSequence(managedSequence);
    if (pendingLaunches.get(nonce) !== pending) throw stalePlaybackRequest();
    // createPlayerInstance loads this plugin's main entry synchronously before
    // returning the numeric player handle. Deliver by that handle instead of
    // depending on IINA 1.4.4's broken child-to-Global callback context.
    await runOnIinaMainThread(() => {
      assertConnectionGeneration(pending.generation);
      assertManagedPlaybackSequence(managedSequence);
      if (pendingLaunches.get(nonce) !== pending) throw stalePlaybackRequest();
      api.global.postMessage(playerId, PLAYER_MESSAGES.launch, pending.launch);
      // Claim the reusable handle only in the same main-run-loop callback that
      // successfully delivered the still-current launch. A superseded create
      // remains tracked for cleanup/reuse but can never steal managed ownership.
      if (!request.openInNewWindow) managedPlayerId = playerId;
    });
    pendingLaunches.delete(nonce);
  } catch (error) {
    pendingLaunches.delete(nonce);
    throw error;
  }
  return { status: 'started', plan: publicPlan };
}

async function launchPlayback(request: PlaybackRequest): Promise<unknown> {
  if (request.videoTranscodeConfirmationId !== undefined) {
    const confirmed = playbackConfirmations.consume(request.videoTranscodeConfirmationId, request, {
      connectionGeneration,
      managedSequence: managedPlaybackSequence,
    });
    if (confirmed !== undefined) {
      const correlation = confirmed.value.launch.diagnosticCorrelation;
      logger.info('playback.confirmation.accepted', { correlation });
      return deliverPreparedLaunch(request, confirmed.value, confirmed.managedSequence);
    }
  }

  const correlation = createOpaqueId('diagnostic-playback');
  logger.info('playback.prepare.begin', {
    correlation,
    resume: request.startPositionTicks > 0,
    openInNewWindow: request.openInNewWindow === true,
    requestedVersion: request.mediaSourceId !== undefined,
    requestedAudio: request.audioStreamIndex !== undefined,
    requestedSubtitles: request.subtitleStreamIndex !== undefined,
    suppliedConfirmation: request.videoTranscodeConfirmationId !== undefined,
  });
  const managedSequence = request.openInNewWindow ? undefined : ++managedPlaybackSequence;
  const prepared = await prepareLaunch(request);
  prepared.launch.diagnosticCorrelation = correlation;
  assertManagedPlaybackSequence(managedSequence);
  logger.info('playback.plan.ready', {
    correlation,
    playMethod: prepared.launch.plan.playMethod,
    conversion: prepared.launch.plan.conversion,
    confirmationRequired: prepared.launch.plan.requiresVideoTranscodeConfirmation,
    externalSubtitle: prepared.launch.plan.externalSubtitle !== undefined,
    selectedAudio: prepared.launch.plan.audioStreamIndex !== undefined,
    selectedSubtitles: prepared.launch.plan.subtitleStreamIndex !== undefined,
  });
  if (prepared.launch.plan.requiresVideoTranscodeConfirmation) {
    const confirmationId = playbackConfirmations.issue(request, prepared, {
      connectionGeneration,
      ...(managedSequence === undefined ? {} : { managedSequence }),
    });
    logger.info('playback.confirmation.required', { correlation });
    return {
      status: 'confirmation-required',
      plan: prepared.publicPlan,
      confirmationId,
    };
  }

  return deliverPreparedLaunch(request, prepared, managedSequence);
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
        await acceptAuthenticatedConnection(authenticated, () => {
          assertConnectionGeneration(generation);
        });
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
        if (!result.authenticated) {
          assertConnectionGeneration(generation);
          if (quickConnectAttempt !== attempt) throw staleRequest();
          respond(request, { authenticated: false });
          return;
        }
        await acceptAuthenticatedConnection(result, () => {
          assertConnectionGeneration(generation);
          if (quickConnectAttempt !== attempt) throw staleRequest();
        });
        quickConnectAttempt = undefined;
        respond(request, {
          authenticated: true,
          connection: publicConnection(result.metadata),
        });
        return;
      }
      case 'connection.disconnect': {
        let context: AuthenticatedApiContext | undefined;
        try {
          context = storedAuthenticatedContext();
        } catch {
          // Local erasure below is authoritative even if the token cannot be read for revocation.
        }
        connectionGeneration += 1;
        connectionStore.clear();
        quickConnectAttempt = undefined;
        quickConnectGeneration = connectionGeneration;
        pendingLaunches.clear();
        playbackConfirmations.clear();
        stopTrackedPlayers('closed');
        if (context !== undefined) {
          // Player cores keep their own in-memory context long enough to send
          // their final stopped reports. IINA has no child-to-Global
          // acknowledgement that is reliable in 1.4.4, so delay revocation by
          // a short bounded grace period instead of invalidating those reports.
          setTimeout(() => {
            void revokeSession(context, 'Could not revoke the disconnected Jellyfin session');
          }, SESSION_REVOCATION_GRACE_MS);
        }
        respond(request, { disconnected: true });
        return;
      }
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
        playbackConfirmations.clear();
        prunePendingLaunches();
        if (managedPlayerId !== undefined) {
          await postPlayerMessage(managedPlayerId, PLAYER_MESSAGES.stop, {
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

function postCatalogVisible(): void {
  setTimeout(() => {
    api.standaloneWindow.postMessage('catalog.visible', {
      connection: publicConnection(connectionStore.readMetadata()),
    });
  }, 50);
}

function openCatalog(): void {
  catalogOpenRequested = true;
  api.standaloneWindow.open();
  if (catalogReady) postCatalogVisible();
}

function markCatalogReady(): void {
  if (catalogReady) return;
  catalogReady = true;
  if (!catalogOpenRequested) return;
  // A second open after the document mounts forces IINA 1.4.4 to paint a
  // standalone WKWebView that was opened during its cold-load window.
  api.standaloneWindow.open();
  postCatalogVisible();
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
  // A first bridge request also proves the catalog mounted. This closes the
  // narrow race where catalog.ready can be posted while loadFile is still
  // returning and before IINA has installed this entry's message handler.
  markCatalogReady();
  void handleBridgeRequest(data);
});
api.standaloneWindow.onMessage(CATALOG_READY_MESSAGE, () => markCatalogReady());
api.standaloneWindow.onMessage(CATALOG_DIAGNOSTIC_MESSAGE, (data) => {
  const record = parseCatalogDiagnosticRecord(data);
  if (record === undefined) return;
  const fingerprint = `${record.kind}\n${record.message}\n${record.stack ?? ''}`;
  if (
    catalogDiagnosticFingerprints.has(fingerprint) ||
    catalogDiagnosticFingerprints.size >= MAX_CATALOG_DIAGNOSTICS_PER_ENTRY
  ) {
    return;
  }
  catalogDiagnosticFingerprints.add(fingerprint);
  logger.error('Catalog webview failure', record);
});

api.menu.addItem(api.menu.item('Open Jellyfin Library', openCatalog, { keyBinding: 'Alt+Meta+j' }));
api.menu.addItem(api.menu.item('Reveal Jellyfin Diagnostic Log', () => diagnosticLog.reveal()));

setInterval(() => {
  try {
    if (consumeCatalogOpenRequest(api.preferences)) openCatalog();
    if (consumeDiagnosticLogRevealRequest(api.preferences)) diagnosticLog.reveal();
  } catch (error) {
    logger.warn('Could not handle a request from plugin preferences', error);
  }
}, 500);

logger.info('Global Jellyfin integration ready');
