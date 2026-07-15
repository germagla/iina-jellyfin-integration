export type PlayerUiAction =
  | 'host.ready'
  | 'window.openCatalog'
  | 'settings.autoplay'
  | 'player.pause'
  | 'player.resume'
  | 'upNext.playNow'
  | 'upNext.cancel';

export interface PlayerViewState {
  generation: number;
  status: 'idle' | 'preparing' | 'playing' | 'paused' | 'stopped' | 'completed' | 'error';
  positionTicks: number;
  durationTicks?: number;
  title?: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  playMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode';
  artwork?: string;
}

export interface UpNextViewState {
  itemId: string;
  title: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  remainingSeconds: number;
  autoplay: boolean;
  artwork?: string;
}

export interface PlayerUiMessage {
  action: PlayerUiAction;
  payload: Record<string, unknown>;
}

export interface PlayerUiHost {
  send(action: PlayerUiAction, payload?: Record<string, unknown>): Promise<void>;
  getPlayerState(): PlayerViewState | undefined;
  getUpNext(): UpNextViewState | undefined;
  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void;
  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeNonnegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : undefined;
}

export function parsePlayerState(value: unknown): PlayerViewState | undefined {
  const candidate = record(value);
  const generation = safeNonnegativeNumber(candidate?.generation);
  const positionTicks = safeNonnegativeNumber(candidate?.positionTicks);
  const status = candidate?.status;
  const statuses: PlayerViewState['status'][] = [
    'idle',
    'preparing',
    'playing',
    'paused',
    'stopped',
    'completed',
    'error',
  ];
  if (
    candidate === undefined ||
    generation === undefined ||
    positionTicks === undefined ||
    typeof status !== 'string' ||
    !statuses.includes(status as PlayerViewState['status'])
  ) {
    return undefined;
  }

  const parsed: PlayerViewState = {
    generation,
    positionTicks,
    status: status as PlayerViewState['status'],
  };
  const durationTicks = safeNonnegativeNumber(candidate.durationTicks);
  const seasonNumber = safeNonnegativeNumber(candidate.seasonNumber);
  const episodeNumber = safeNonnegativeNumber(candidate.episodeNumber);
  const title = safeText(candidate.title);
  const seriesName = safeText(candidate.seriesName);
  const playMethod = candidate.playMethod;
  if (durationTicks !== undefined) parsed.durationTicks = durationTicks;
  if (seasonNumber !== undefined) parsed.seasonNumber = seasonNumber;
  if (episodeNumber !== undefined) parsed.episodeNumber = episodeNumber;
  if (title !== undefined) parsed.title = title;
  if (seriesName !== undefined) parsed.seriesName = seriesName;
  if (playMethod === 'DirectPlay' || playMethod === 'DirectStream' || playMethod === 'Transcode') {
    parsed.playMethod = playMethod;
  }
  return parsed;
}

export function parseUpNext(value: unknown): UpNextViewState | undefined {
  const candidate = record(value);
  const itemId = safeText(candidate?.itemId);
  const title = safeText(candidate?.title);
  const remainingSeconds = safeNonnegativeNumber(candidate?.remainingSeconds);
  if (
    candidate === undefined ||
    itemId === undefined ||
    title === undefined ||
    remainingSeconds === undefined ||
    typeof candidate.autoplay !== 'boolean'
  ) {
    return undefined;
  }
  const parsed: UpNextViewState = {
    itemId,
    title,
    remainingSeconds: Math.min(60, Math.floor(remainingSeconds)),
    autoplay: candidate.autoplay,
  };
  const seriesName = safeText(candidate.seriesName);
  const seasonNumber = safeNonnegativeNumber(candidate.seasonNumber);
  const episodeNumber = safeNonnegativeNumber(candidate.episodeNumber);
  if (seriesName !== undefined) parsed.seriesName = seriesName;
  if (seasonNumber !== undefined) parsed.seasonNumber = seasonNumber;
  if (episodeNumber !== undefined) parsed.episodeNumber = episodeNumber;
  return parsed;
}

class NativePlayerUiHost implements PlayerUiHost {
  private playerState: PlayerViewState | undefined;
  private upNext: UpNextViewState | undefined;
  private readonly stateListeners = new Set<(state: PlayerViewState) => void>();
  private readonly upNextListeners = new Set<(state: UpNextViewState | undefined) => void>();

  constructor() {
    window.iina?.onMessage('player.state', (value) => {
      const state = parsePlayerState(value);
      if (state === undefined) return;
      this.playerState = state;
      for (const listener of this.stateListeners) listener(state);
    });
    window.iina?.onMessage('player.upNext', (value) => {
      const state = value === null ? undefined : parseUpNext(value);
      if (value !== null && state === undefined) return;
      this.upNext = state;
      for (const listener of this.upNextListeners) listener(state);
    });
    void this.send('host.ready');
  }

  async send(action: PlayerUiAction, payload: Record<string, unknown> = {}): Promise<void> {
    window.iina?.postMessage('host.action', { action, ...payload });
  }

  getPlayerState(): PlayerViewState | undefined {
    return this.playerState;
  }

  getUpNext(): UpNextViewState | undefined {
    return this.upNext;
  }

  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void {
    this.upNextListeners.add(listener);
    return () => this.upNextListeners.delete(listener);
  }
}

const demoPlayerState: PlayerViewState = {
  generation: 1,
  status: 'playing',
  positionTicks: 14_480_000_000,
  durationTicks: 26_400_000_000,
  title: 'Crossing Lines',
  seriesName: 'Horizons',
  seasonNumber: 1,
  episodeNumber: 3,
  playMethod: 'DirectPlay',
  artwork: '../../demo/episode-crossing-lines.png',
};

const demoUpNext: UpNextViewState = {
  itemId: 'horizons-episode-4',
  title: 'Echoes',
  seriesName: 'Horizons',
  seasonNumber: 1,
  episodeNumber: 4,
  remainingSeconds: 10,
  autoplay: true,
  artwork: '../../demo/episode-echoes.png',
};

export class MockPlayerUiHost implements PlayerUiHost {
  readonly messages: PlayerUiMessage[] = [];
  private playerState: PlayerViewState | undefined;
  private upNext: UpNextViewState | undefined;
  private readonly stateListeners = new Set<(state: PlayerViewState) => void>();
  private readonly upNextListeners = new Set<(state: UpNextViewState | undefined) => void>();

  constructor(options: { playerState?: PlayerViewState; upNext?: UpNextViewState } = {}) {
    this.playerState = options.playerState ?? demoPlayerState;
    this.upNext = options.upNext ?? demoUpNext;
  }

  async send(action: PlayerUiAction, payload: Record<string, unknown> = {}): Promise<void> {
    this.messages.push({ action, payload });
  }

  getPlayerState(): PlayerViewState | undefined {
    return this.playerState;
  }

  getUpNext(): UpNextViewState | undefined {
    return this.upNext;
  }

  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void {
    this.upNextListeners.add(listener);
    return () => this.upNextListeners.delete(listener);
  }

  emitPlayerState(state: PlayerViewState): void {
    this.playerState = state;
    for (const listener of this.stateListeners) listener(state);
  }

  emitUpNext(state: UpNextViewState | undefined): void {
    this.upNext = state;
    for (const listener of this.upNextListeners) listener(state);
  }
}

export function createPlayerUiHost(): PlayerUiHost {
  return window.iina ? new NativePlayerUiHost() : new MockPlayerUiHost();
}
