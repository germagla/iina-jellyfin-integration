import {
  BridgeResponseSchema,
  PublicPlaybackPlanSchema,
  parseBridgeResult,
} from '@iina-jellyfin/core';
import { demoHome, demoMovies, demoShowDetails, demoShows } from '../demo/catalog';
import type {
  BridgeOperation,
  BridgePayload,
  BridgeRequest,
  BridgeResponse,
  BridgeResultMap,
  CatalogBridge,
  CatalogRequest,
  EpisodeDetails,
  MediaCard,
  PlaybackConfirmationNotice,
  PublicConnection,
} from './contracts';

interface IinaWebviewBridge {
  postMessage(name: string, data: unknown): void;
  onMessage(name: string, handler: (data: unknown) => void): void;
}

declare global {
  interface Window {
    iina?: IinaWebviewBridge;
  }
}

type PendingRequest = {
  operation: BridgeOperation;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseResponse(value: unknown): BridgeResponse | undefined {
  const parsed = BridgeResponseSchema.safeParse(value);
  return parsed.success ? (parsed.data as BridgeResponse) : undefined;
}

function parsePlaybackConfirmationNotice(value: unknown): PlaybackConfirmationNotice | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Partial<PlaybackConfirmationNotice>;
  if (
    typeof candidate.itemId !== 'string' ||
    candidate.itemId.length === 0 ||
    candidate.itemId.length > 256 ||
    candidate.source !== 'up-next' ||
    typeof candidate.openInNewWindow !== 'boolean' ||
    typeof candidate.plan !== 'object' ||
    candidate.plan === null
  ) {
    return undefined;
  }
  const plan = PublicPlaybackPlanSchema.safeParse(candidate.plan);
  if (!plan.success || !plan.data.requiresVideoTranscodeConfirmation) return undefined;

  return {
    itemId: candidate.itemId,
    source: 'up-next',
    openInNewWindow: candidate.openInNewWindow,
    plan: {
      playMethod: plan.data.playMethod,
      conversion: plan.data.conversion,
      requiresVideoTranscodeConfirmation: true,
      transcodeReasons: [...plan.data.transcodeReasons],
      mediaSourceId: plan.data.mediaSourceId,
      ...(plan.data.audioStreamIndex === undefined
        ? {}
        : { audioStreamIndex: plan.data.audioStreamIndex }),
      ...(plan.data.subtitleStreamIndex === undefined
        ? {}
        : { subtitleStreamIndex: plan.data.subtitleStreamIndex }),
    },
  };
}

export class NativeBridge implements CatalogBridge {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly invalidationListeners = new Set<() => void>();
  private readonly confirmationListeners = new Set<(notice: PlaybackConfirmationNotice) => void>();
  private queuedConfirmation?: PlaybackConfirmationNotice;

  constructor(private readonly native: IinaWebviewBridge) {
    native.onMessage('bridge.response', (message) => this.handleResponse(message));
    native.onMessage('catalog.invalidated', () => this.notifyInvalidated());
    native.onMessage('catalog.visible', () => this.notifyInvalidated());
    native.onMessage('playback.confirmation-required', (message) =>
      this.handlePlaybackConfirmation(message),
    );
  }

  subscribeInvalidation(listener: () => void): () => void {
    this.invalidationListeners.add(listener);
    return () => this.invalidationListeners.delete(listener);
  }

  subscribePlaybackConfirmation(
    listener: (notice: PlaybackConfirmationNotice) => void,
  ): () => void {
    this.confirmationListeners.add(listener);
    if (this.queuedConfirmation) {
      const notice = this.queuedConfirmation;
      this.queuedConfirmation = undefined;
      listener(notice);
    }
    return () => this.confirmationListeners.delete(listener);
  }

  request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    const requestId = createRequestId();
    const envelope = { requestId, operation, payload } as BridgeRequest;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('IINA did not respond. Please try again.'));
      }, 15_000);

      this.pending.set(requestId, {
        operation,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      this.native.postMessage('bridge.request', envelope);
    });
  }

  private handleResponse(message: unknown): void {
    const response = parseResponse(message);
    if (response === undefined) return;
    const pending = this.pending.get(response.requestId);
    if (!pending || pending.operation !== response.operation) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);

    if (response.ok) {
      try {
        pending.resolve(parseBridgeResult(response.operation, response.result));
      } catch {
        pending.reject(new Error('IINA returned an invalid Jellyfin response. Please try again.'));
      }
    } else {
      pending.reject(new Error(response.error.message));
    }
  }

  private notifyInvalidated(): void {
    for (const listener of this.invalidationListeners) listener();
  }

  private handlePlaybackConfirmation(message: unknown): void {
    const notice = parsePlaybackConfirmationNotice(message);
    if (!notice) return;
    if (this.confirmationListeners.size === 0) {
      this.queuedConfirmation = notice;
      return;
    }
    for (const listener of this.confirmationListeners) listener(notice);
  }
}

const demoConnection: PublicConnection = {
  serverUrl: 'https://jellyfin.example.com/media',
  serverId: 'demo-server',
  serverName: 'Living Room Server',
  userId: 'demo-user',
  username: 'Alex',
  transport: 'https',
  lastConnectedAt: '2026-07-15T00:00:00.000Z',
};

export class MockBridge implements CatalogBridge {
  readonly requests: BridgeRequest[] = [];
  private readonly confirmationListeners = new Set<(notice: PlaybackConfirmationNotice) => void>();

  constructor(
    private connected = true,
    private readonly overrides: Partial<{
      [K in BridgeOperation]: BridgeResultMap[K] | Error;
    }> = {},
  ) {}

  async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    this.requests.push({ requestId: createRequestId(), operation, payload } as BridgeRequest);
    const override = this.overrides[operation];
    if (override instanceof Error) throw override;
    if (override !== undefined) return override as BridgeResultMap[K];
    return this.handle(operation, payload) as BridgeResultMap[K];
  }

  subscribePlaybackConfirmation(
    listener: (notice: PlaybackConfirmationNotice) => void,
  ): () => void {
    this.confirmationListeners.add(listener);
    return () => this.confirmationListeners.delete(listener);
  }

  emitPlaybackConfirmation(notice: PlaybackConfirmationNotice): void {
    for (const listener of this.confirmationListeners) listener(notice);
  }

  private handle<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): BridgeResultMap[K] {
    switch (operation) {
      case 'connection.probe':
        return {
          server: { Id: 'demo-server', ServerName: 'Living Room Server', Version: '10.11.0' },
          normalizedUrl: 'https://jellyfin.example.com/media',
          transportPolicy: 'secure',
          isLocal: false,
        } as BridgeResultMap[K];
      case 'connection.login.password':
        this.connected = true;
        return { connection: demoConnection } as BridgeResultMap[K];
      case 'connection.quickConnect.start':
        return {
          code: '842916',
          serverName: 'Living Room Server',
          expiresInSeconds: 600,
        } as BridgeResultMap[K];
      case 'connection.quickConnect.poll':
        this.connected = true;
        return { authenticated: true, connection: demoConnection } as BridgeResultMap[K];
      case 'connection.disconnect':
        this.connected = false;
        return { disconnected: true } as BridgeResultMap[K];
      case 'catalog.query':
        return mockCatalog(payload as CatalogRequest) as BridgeResultMap[K];
      case 'artwork.fetch':
        return { dataUrl: '' } as BridgeResultMap[K];
      case 'catalog.refresh':
        return {
          connection: this.connected ? demoConnection : undefined,
          refreshedAt: new Date().toISOString(),
        } as BridgeResultMap[K];
      case 'playback.start': {
        const request = payload as BridgePayload<'playback.start'>;
        const requiresVideoTranscode = request.mediaSourceId === 'source-4k';
        const approved =
          !requiresVideoTranscode ||
          request.videoTranscodeApproved ||
          request.itemId === 'horizons-episode-4';
        return {
          status: approved ? 'started' : 'confirmation-required',
          plan: {
            playMethod: approved ? 'DirectPlay' : 'Transcode',
            conversion: approved ? 'none' : 'video',
            requiresVideoTranscodeConfirmation: !approved,
            transcodeReasons: approved ? [] : ['VideoCodecNotSupported'],
            mediaSourceId: request.mediaSourceId ?? 'source-1080',
            audioStreamIndex: request.audioStreamIndex,
            subtitleStreamIndex: request.subtitleStreamIndex,
          },
        } as BridgeResultMap[K];
      }
      case 'playback.stop':
        return { stopped: true } as BridgeResultMap[K];
    }
  }
}

function mockCatalog(request: CatalogRequest): unknown {
  if (request.kind === 'details') {
    const episode = demoShowDetails.episodes.find((candidate) => candidate.id === request.itemId);
    if (!episode) return demoShowDetails;
    return {
      ...demoShowDetails,
      id: episode.id,
      episodeTitle: episode.title,
      episodeLabel:
        episode.seasonNumber !== undefined && episode.episodeNumber !== undefined
          ? `S${episode.seasonNumber} · E${episode.episodeNumber}`
          : 'Episode',
      runtimeMinutes: episode.runtimeMinutes ?? demoShowDetails.runtimeMinutes,
      progress: episode.progress ?? 0,
      progressLabel: episode.progress
        ? `${Math.max(0, Math.round((episode.runtimeMinutes ?? demoShowDetails.runtimeMinutes) * (1 - episode.progress)))} min remaining`
        : 'Not started',
    };
  }
  if (request.kind === 'home') {
    const source = demoHome[request.shelf];
    return mockItemsResult(source.slice(0, request.limit), 0, source.length);
  }
  if (request.kind === 'search') {
    const query = request.query.toLocaleLowerCase();
    const source = [...demoShows, ...demoMovies].filter((item) =>
      item.title.toLocaleLowerCase().includes(query),
    );
    return mockItemsResult(
      source.slice(request.startIndex, request.startIndex + request.limit),
      request.startIndex,
      source.length,
    );
  }
  if (request.kind === 'episodes') {
    return mockItemsResult(
      demoShowDetails.episodes,
      request.startIndex,
      demoShowDetails.episodes.length,
    );
  }
  if (request.kind === 'libraries') {
    return mockItemsResult([], 0, 0);
  }

  const source = request.itemType === 'Movie' ? demoMovies : demoShows;
  const sort =
    request.sortBy === 'SortName' ? 'title' : request.sortBy === 'PremiereDate' ? 'year' : 'recent';
  const sorted = sortItems(source, sort);
  return mockItemsResult(
    sorted.slice(request.startIndex, request.startIndex + request.limit),
    request.startIndex,
    sorted.length,
  );
}

function mockItemsResult(items: (MediaCard | EpisodeDetails)[], startIndex: number, total: number) {
  return {
    Items: items.map((item) => ({
      Id: item.id,
      Name: item.title,
      Type: item.kind === 'movie' ? 'Movie' : item.kind === 'series' ? 'Series' : 'Episode',
      ProductionYear: item.year,
      RunTimeTicks: item.runtimeMinutes ? item.runtimeMinutes * 60 * 10_000_000 : undefined,
      ParentIndexNumber: 'seasonNumber' in item ? item.seasonNumber : undefined,
      IndexNumber: 'episodeNumber' in item ? item.episodeNumber : undefined,
      SeriesName: item.subtitle,
      UserData:
        item.progress === undefined && item.playbackPositionTicks === undefined
          ? undefined
          : {
              PlayedPercentage: item.progress === undefined ? undefined : item.progress * 100,
              PlaybackPositionTicks: item.playbackPositionTicks,
            },
      MediaSources:
        'versions' in item
          ? item.versions.map((version) => ({
              Id: version.id,
              Name: version.label,
              DefaultAudioStreamIndex: Number(version.defaultAudioTrackId),
              DefaultSubtitleStreamIndex: Number(version.defaultSubtitleTrackId),
              MediaStreams: [
                ...version.audioTracks.flatMap((track) => {
                  const index = Number(track.id);
                  return Number.isInteger(index)
                    ? [
                        {
                          Index: index,
                          Type: 'Audio',
                          DisplayTitle: track.label,
                          IsDefault: track.id === version.defaultAudioTrackId,
                        },
                      ]
                    : [];
                }),
                ...version.subtitleTracks.flatMap((track) => {
                  const index = Number(track.id);
                  return Number.isInteger(index) && index >= 0
                    ? [
                        {
                          Index: index,
                          Type: 'Subtitle',
                          DisplayTitle: track.label,
                          IsDefault: track.id === version.defaultSubtitleTrackId,
                        },
                      ]
                    : [];
                }),
              ],
            }))
          : undefined,
      DemoArtwork: item.artwork,
      UnwatchedCount: item.unwatchedCount,
    })),
    TotalRecordCount: total,
    StartIndex: startIndex,
  };
}

function sortItems(items: MediaCard[], sort: 'recent' | 'title' | 'year'): MediaCard[] {
  const copy = [...items];
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'year') return copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  return copy;
}

export function createCatalogBridge(): CatalogBridge {
  return window.iina ? new NativeBridge(window.iina) : new MockBridge();
}
