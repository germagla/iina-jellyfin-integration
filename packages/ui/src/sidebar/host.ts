export type PlayerUiAction =
  | 'host.ready'
  | 'host.webviewError'
  | 'window.openCatalog'
  | 'settings.autoplay'
  | 'settings.chapterSkipMode'
  | 'player.pause'
  | 'player.resume'
  | 'chapterSkip.skip'
  | 'upNext.playNow'
  | 'upNext.cancel';

export type ChapterSkipMode = 'on' | 'prompt' | 'off';

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

export interface ChapterSkipViewState {
  generation: number;
  chapterIndex: number;
  title: string;
  expiresAtMs: number;
}

export interface ChapterSkipSettingsState {
  mode: ChapterSkipMode;
}

export interface PlayerUiMessage {
  action: PlayerUiAction;
  payload: Record<string, unknown>;
}

export interface PlayerUiHost {
  send(action: PlayerUiAction, payload?: Record<string, unknown>): Promise<void>;
  getPlayerState(): PlayerViewState | undefined;
  getUpNext(): UpNextViewState | undefined;
  getChapterSkip(): ChapterSkipViewState | undefined;
  getChapterSkipSettings(): ChapterSkipSettingsState;
  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void;
  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void;
  subscribeChapterSkip(listener: (state: ChapterSkipViewState | undefined) => void): () => void;
  subscribeChapterSkipSettings(listener: (state: ChapterSkipSettingsState) => void): () => void;
}

export type PlayerWebviewSurface = 'sidebar' | 'overlay';
export type PlayerWebviewErrorKind = 'error' | 'unhandledrejection' | 'render';

const WEBVIEW_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'DOMException',
]);

function describeWebviewError(value: unknown): string {
  // Exception messages may contain a media URL, Jellyfin metadata, or another
  // user-controlled value. Preserve only a conventional error class so the
  // diagnostic log remains useful without copying webview content into it.
  if (value instanceof Error) {
    return WEBVIEW_ERROR_NAMES.has(value.name) ? value.name : 'Error';
  }
  return value === null ? 'NonError:null' : `NonError:${typeof value}`;
}

export function reportPlayerWebviewError(
  surface: PlayerWebviewSurface,
  kind: PlayerWebviewErrorKind,
  value: unknown,
): void {
  window.iina?.postMessage('host.action', {
    action: 'host.webviewError',
    surface,
    kind,
    message: describeWebviewError(value),
  });
}

export function installPlayerWebviewErrorReporting(surface: PlayerWebviewSurface): void {
  window.addEventListener('error', (event) => {
    reportPlayerWebviewError(surface, 'error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportPlayerWebviewError(surface, 'unhandledrejection', event.reason);
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function safeNonnegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeNonnegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
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

export function parseChapterSkip(value: unknown): ChapterSkipViewState | undefined {
  const candidate = record(value);
  const generation = safeNonnegativeInteger(candidate?.generation);
  const chapterIndex = safeNonnegativeInteger(candidate?.chapterIndex);
  const title = safeText(candidate?.title);
  const expiresAtMs = safeNonnegativeNumber(candidate?.expiresAtMs);
  if (
    candidate === undefined ||
    generation === undefined ||
    chapterIndex === undefined ||
    title === undefined ||
    title.length > 128 ||
    expiresAtMs === undefined
  ) {
    return undefined;
  }
  return { generation, chapterIndex, title, expiresAtMs };
}

export function parseChapterSkipSettings(value: unknown): ChapterSkipSettingsState | undefined {
  const mode = record(value)?.mode;
  return mode === 'on' || mode === 'prompt' || mode === 'off' ? { mode } : undefined;
}

class NativePlayerUiHost implements PlayerUiHost {
  private playerState: PlayerViewState | undefined;
  private upNext: UpNextViewState | undefined;
  private chapterSkip: ChapterSkipViewState | undefined;
  private chapterSkipSettings: ChapterSkipSettingsState = { mode: 'prompt' };
  private readonly stateListeners = new Set<(state: PlayerViewState) => void>();
  private readonly upNextListeners = new Set<(state: UpNextViewState | undefined) => void>();
  private readonly chapterSkipListeners = new Set<
    (state: ChapterSkipViewState | undefined) => void
  >();
  private readonly chapterSkipSettingsListeners = new Set<
    (state: ChapterSkipSettingsState) => void
  >();

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
    window.iina?.onMessage('player.chapterSkip', (value) => {
      const state = value === null ? undefined : parseChapterSkip(value);
      if (value !== null && state === undefined) return;
      this.chapterSkip = state;
      for (const listener of this.chapterSkipListeners) listener(state);
    });
    window.iina?.onMessage('player.chapterSkipSettings', (value) => {
      const state = parseChapterSkipSettings(value);
      if (state === undefined) return;
      this.chapterSkipSettings = state;
      for (const listener of this.chapterSkipSettingsListeners) listener(state);
    });
    void this.send('host.ready');
    // IINA installs the native overlay listener from its didFinish callback,
    // after this document's first script turn can already have completed.
    // Repeat the idempotent handshake once so the overlay cannot miss it.
    window.setTimeout(() => void this.send('host.ready'), 250);
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

  getChapterSkip(): ChapterSkipViewState | undefined {
    return this.chapterSkip;
  }

  getChapterSkipSettings(): ChapterSkipSettingsState {
    return this.chapterSkipSettings;
  }

  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void {
    this.upNextListeners.add(listener);
    return () => this.upNextListeners.delete(listener);
  }

  subscribeChapterSkip(listener: (state: ChapterSkipViewState | undefined) => void): () => void {
    this.chapterSkipListeners.add(listener);
    return () => this.chapterSkipListeners.delete(listener);
  }

  subscribeChapterSkipSettings(listener: (state: ChapterSkipSettingsState) => void): () => void {
    this.chapterSkipSettingsListeners.add(listener);
    return () => this.chapterSkipSettingsListeners.delete(listener);
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
  private chapterSkip: ChapterSkipViewState | undefined;
  private chapterSkipSettings: ChapterSkipSettingsState;
  private readonly stateListeners = new Set<(state: PlayerViewState) => void>();
  private readonly upNextListeners = new Set<(state: UpNextViewState | undefined) => void>();
  private readonly chapterSkipListeners = new Set<
    (state: ChapterSkipViewState | undefined) => void
  >();
  private readonly chapterSkipSettingsListeners = new Set<
    (state: ChapterSkipSettingsState) => void
  >();

  constructor(
    options: {
      playerState?: PlayerViewState;
      upNext?: UpNextViewState;
      chapterSkip?: ChapterSkipViewState;
      chapterSkipSettings?: ChapterSkipSettingsState;
    } = {},
  ) {
    this.playerState = options.playerState ?? demoPlayerState;
    this.upNext = 'upNext' in options ? options.upNext : demoUpNext;
    this.chapterSkip = options.chapterSkip;
    this.chapterSkipSettings = options.chapterSkipSettings ?? { mode: 'prompt' };
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

  getChapterSkip(): ChapterSkipViewState | undefined {
    return this.chapterSkip;
  }

  getChapterSkipSettings(): ChapterSkipSettingsState {
    return this.chapterSkipSettings;
  }

  subscribePlayerState(listener: (state: PlayerViewState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  subscribeUpNext(listener: (state: UpNextViewState | undefined) => void): () => void {
    this.upNextListeners.add(listener);
    return () => this.upNextListeners.delete(listener);
  }

  subscribeChapterSkip(listener: (state: ChapterSkipViewState | undefined) => void): () => void {
    this.chapterSkipListeners.add(listener);
    return () => this.chapterSkipListeners.delete(listener);
  }

  subscribeChapterSkipSettings(listener: (state: ChapterSkipSettingsState) => void): () => void {
    this.chapterSkipSettingsListeners.add(listener);
    return () => this.chapterSkipSettingsListeners.delete(listener);
  }

  emitPlayerState(state: PlayerViewState): void {
    this.playerState = state;
    for (const listener of this.stateListeners) listener(state);
  }

  emitUpNext(state: UpNextViewState | undefined): void {
    this.upNext = state;
    for (const listener of this.upNextListeners) listener(state);
  }

  emitChapterSkip(state: ChapterSkipViewState | undefined): void {
    this.chapterSkip = state;
    for (const listener of this.chapterSkipListeners) listener(state);
  }

  emitChapterSkipSettings(state: ChapterSkipSettingsState): void {
    this.chapterSkipSettings = state;
    for (const listener of this.chapterSkipSettingsListeners) listener(state);
  }
}

export function createPlayerUiHost(): PlayerUiHost {
  return window.iina ? new NativePlayerUiHost() : new MockPlayerUiHost();
}
