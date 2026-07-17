import {
  BaseItemSchema,
  CATALOG_OPEN_REQUEST_PREFERENCE_KEY,
  PlaybackPlanSchema,
  beginPlaybackSession,
  buildPlaybackReportRequest,
  clampPositionTicks,
  createIdlePlaybackSession,
  queryValueCaseInsensitive,
  reducePlaybackSession,
  secondsToTicks,
  shouldReportPeriodicProgress,
  ticksToSeconds,
  type PlaybackProgressEventName,
  type PlaybackSessionState,
  type PublicPlaybackState,
} from '@iina-jellyfin/core';
import {
  AUTO_SKIP_CHAPTER_TITLES_PREFERENCE_KEY,
  DEFAULT_PROGRESS_INTERVAL_MS,
  PLAYER_MESSAGES,
} from './constants';
import type { IinaHttpTransport } from './iina-http';
import type { PlayerLaunch } from './player-messages';
import { writePlaybackState } from './playback-state-mailbox';
import type { SafeLogger } from './safe-logger';

interface PlayerApi {
  core: IINA.API.Core;
  event: IINA.API.Event;
  file: IINA.API.File;
  global: IINA.API.Global;
  http: IINA.API.HTTP;
  mpv: IINA.API.MPV;
  preferences: IINA.API.Preferences;
  sidebar: IINA.API.SidebarView;
  overlay: IINA.API.Overlay;
  utils: IINA.API.Utils;
}

class StalePlayerLoadError extends Error {
  constructor() {
    super('A newer player load replaced this request.');
    this.name = 'StalePlayerLoadError';
  }
}

const MAX_EXTERNAL_SUBTITLE_BYTES = 10 * 1024 * 1024;
const CORE_STOP_ACK_TIMEOUT_MS = 750;

interface UpNextState {
  itemId: string;
  title: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  remainingSeconds: number;
  autoplay: boolean;
}

function safeHeaders(headers: Record<string, string>): string[] {
  const result: string[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) continue;
    result.push(`${name}: ${value}`);
  }
  return result;
}

function safeSubtitleExtension(codec: string | undefined): string {
  const normalized = codec?.toLowerCase();
  return normalized === 'ass' || normalized === 'ssa' || normalized === 'vtt' ? normalized : 'srt';
}

function safeTemporaryNameComponent(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96);
  return normalized.length > 0 ? normalized : 'playback';
}

function transcodeStartOffset(plan: PlayerLaunch['plan']): number {
  if (plan.playMethod === 'DirectPlay') return 0;
  try {
    const value = queryValueCaseInsensitive(plan.url, 'StartTimeTicks');
    const parsed = Number(value);
    return value !== undefined && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // The plan schema already validates URLs. Falling back keeps reporting safe.
  }
  // Without an explicit server offset, mpv still needs to seek locally.
  return 0;
}

function localStartPositionSeconds(plan: PlayerLaunch['plan']): number {
  const serverStartOffset = transcodeStartOffset(plan);
  return ticksToSeconds(Math.max(0, plan.startPositionTicks - serverStartOffset));
}

function parseAutoSkipChapterTitles(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
}

function mediaTitle(display: PlayerLaunch['display']): string {
  if (
    display.seriesName !== undefined &&
    display.seasonNumber !== undefined &&
    display.episodeNumber !== undefined
  ) {
    return `${display.seriesName} — S${String(display.seasonNumber).padStart(2, '0')}E${String(display.episodeNumber).padStart(2, '0')} — ${display.title}`;
  }
  return display.title;
}

export class PlayerRuntime {
  private session: PlaybackSessionState = createIdlePlaybackSession();
  private launch: PlayerLaunch | undefined;
  private readonly pendingLaunchesForHook: Array<{
    launch: PlayerLaunch;
    replacementSequence: number;
  }> = [];
  private startedGeneration = -1;
  private positionBaseTicks = 0;
  private progressTimer: ReturnType<typeof setInterval> | undefined;
  private sidebarReady = false;
  private overlayReady = false;
  private upNext: UpNextState | undefined;
  private upNextTimer: ReturnType<typeof setInterval> | undefined;
  private externalSubtitlePath: string | undefined;
  private reportQueue: Promise<void> = Promise.resolve();
  private controlQueue: Promise<void> = Promise.resolve();
  private replacementSequence = 0;
  private replacementEndFilesToIgnore = 0;
  private pendingCoreStopAcknowledgement: (() => void) | undefined;
  private loadSequence = 0;
  private activeLoadReplacementSequence: number | undefined;
  private playbackStateSequence = 0;
  private playbackStartedAtMs = 0;
  private playbackStatePersistenceFailed = false;
  private autoSkipChapterTitles: string[] = [];

  constructor(
    private readonly api: PlayerApi,
    private readonly transport: IinaHttpTransport,
    private readonly logger: SafeLogger,
  ) {}

  install(): void {
    this.autoSkipChapterTitles = parseAutoSkipChapterTitles(
      this.api.preferences.get(AUTO_SKIP_CHAPTER_TITLES_PREFERENCE_KEY),
    );
    this.api.global.onMessage(PLAYER_MESSAGES.launch, (raw) => this.receiveLaunch(raw));
    this.api.global.onMessage(PLAYER_MESSAGES.stop, (raw) => {
      const requested = (raw as { reason?: unknown }).reason;
      const reason = requested === 'closed' || requested === 'replaced' ? requested : 'user';
      this.replacementSequence += 1;
      this.discardPendingHandoffs();
      this.invalidatePendingLoads();
      this.enqueueControl(() => this.stop(reason, false));
    });
    this.api.global.onMessage(PLAYER_MESSAGES.upNext, (raw) => this.receiveUpNext(raw));

    this.api.mpv.addHook('on_load', 90, async (next) => {
      await this.resolveLoad(next);
    });

    this.api.event.on('iina.window-loaded', () => this.loadPlayerViews());
    this.api.event.on('iina.file-loaded', () => void this.mediaLoaded());
    this.api.event.on('mpv.pause.changed', () => void this.pauseChanged());
    this.api.event.on('mpv.speed.changed', () => this.playbackTimingChanged());
    this.api.event.on('mpv.paused-for-cache.changed', () => this.playbackTimingChanged());
    this.api.event.on('mpv.chapter.changed', () => this.autoSkipChapter());
    this.api.event.on('mpv.seek', () => void this.reportImmediate('seek'));
    this.api.event.on('mpv.end-file', () => {
      this.handleEndFile();
    });
    this.api.event.on('iina.window-will-close', () => {
      this.clearProgressTimer();
      this.replacementSequence += 1;
      this.discardPendingHandoffs();
      this.invalidatePendingLoads();
      this.enqueueControl(() => this.stop('closed', true));
    });

    this.api.sidebar.onMessage('host.action', (data) => this.handleViewAction(data, 'sidebar'));
    this.api.overlay.onMessage('host.action', (data) => this.handleViewAction(data, 'overlay'));

    this.ensureProgressTimer();
  }

  private receiveLaunch(raw: unknown): void {
    if (raw === null || typeof raw !== 'object') return;
    const candidate = raw as Partial<PlayerLaunch>;
    if (
      typeof candidate.nonce !== 'string' ||
      candidate.context === undefined ||
      candidate.display === undefined
    ) {
      return;
    }
    const parsed = PlaybackPlanSchema.safeParse(candidate.plan);
    if (!parsed.success) return;
    const launch: PlayerLaunch = {
      nonce: candidate.nonce,
      plan: parsed.data,
      context: candidate.context,
      display: candidate.display,
    };
    if (
      typeof candidate.diagnosticCorrelation === 'string' &&
      candidate.diagnosticCorrelation.length <= 512
    ) {
      launch.diagnosticCorrelation = candidate.diagnosticCorrelation;
    }
    // IINA retains plugin-managed PlayerCore instances after their windows close.
    // A later launch reuses the same main entry, so restart the timer stopped by
    // window-will-close instead of assuming install() will run again.
    this.ensureProgressTimer();
    const sequence = ++this.replacementSequence;
    this.invalidatePendingLoads();
    this.enqueueControl(() => this.replace(launch, sequence));
  }

  private autoSkipChapter(): void {
    if (this.launch === undefined || this.autoSkipChapterTitles.length === 0) return;
    const position = this.api.core.status.position;
    if (position === null || !Number.isFinite(position)) return;

    const chapters = this.api.core.getChapters();
    let currentChapter = -1;
    for (let index = 0; index < chapters.length; index += 1) {
      const chapter = chapters[index];
      if (chapter === undefined || chapter.start > position) break;
      currentChapter = index;
    }
    const current = chapters[currentChapter];
    const next = chapters[currentChapter + 1];
    if (
      current === undefined ||
      next === undefined ||
      !this.autoSkipChapterTitles.includes(current.title.trim())
    ) {
      return;
    }

    this.logger.info('player.chapter.auto-skip', {
      correlation: this.launch.diagnosticCorrelation,
      chapter: currentChapter,
    });
    this.api.core.seekTo(next.start);
  }

  private async resolveLoad(next?: () => void): Promise<void> {
    const original = this.api.mpv.getString('stream-open-filename');
    if (original !== 'null://') {
      const ownedLaunch = this.launch;
      const ownedGeneration = this.session.generation;
      this.replacementSequence += 1;
      this.discardPendingHandoffs();
      this.invalidatePendingLoads();
      try {
        if (ownedLaunch !== undefined) await this.releaseForExternalLoad();
      } catch (error) {
        this.logger.warn('Could not release Jellyfin playback for an external load', error);
      } finally {
        // Never let an unrelated URL inherit Jellyfin's HTTP headers, even if
        // session reporting or another cleanup step failed.
        if (ownedLaunch !== undefined) {
          this.clearUpNext(true);
          this.cleanupPlaybackIfOwned(ownedLaunch, ownedGeneration);
        }
        next?.();
      }
      return;
    }

    let pending: (typeof this.pendingLaunchesForHook)[number] | undefined;
    while (this.pendingLaunchesForHook.length > 0) {
      const candidate = this.pendingLaunchesForHook.shift();
      if (candidate?.replacementSequence === this.replacementSequence) {
        pending = candidate;
        break;
      }
    }
    if (pending === undefined) {
      next?.();
      return;
    }

    const loadSequence = this.beginLoad();
    this.deleteExternalSubtitle();
    try {
      const launch = pending.launch;
      this.launch = launch;
      this.activeLoadReplacementSequence = pending.replacementSequence;
      this.session = beginPlaybackSession(this.session, launch.plan);
      this.playbackStartedAtMs = Date.now();
      const generation = this.session.generation;
      // A successful Global handoff is not yet proof that mpv accepted the
      // media. Publish the preparing state immediately so the catalog can
      // acknowledge the exact native session even during slow subtitle/network
      // setup, and can distinguish it from a launch that never reached here.
      this.publishState();
      this.logger.info('player.plan.received', {
        correlation: launch.diagnosticCorrelation,
        playMethod: launch.plan.playMethod,
        conversion: launch.plan.conversion,
        resume: launch.plan.startPositionTicks > 0,
        externalSubtitle: launch.plan.externalSubtitle !== undefined,
        selectedAudio: launch.plan.audioStreamIndex !== undefined,
        selectedSubtitles: launch.plan.subtitleStreamIndex !== undefined,
      });
      this.positionBaseTicks = transcodeStartOffset(launch.plan);
      // IINA enables mpv's watch-later resume feature for ordinary playback. A
      // saved position for this URL must never override Jellyfin's authoritative
      // startPositionTicks (including an explicit zero for Play from Beginning).
      // Keep these options file-local so the user's behavior for non-Jellyfin
      // media is restored as soon as this managed load ends.
      this.api.mpv.set('file-local-options/resume-playback', false);
      this.api.mpv.set('file-local-options/save-position-on-quit', false);
      this.api.mpv.set('file-local-options/start', localStartPositionSeconds(launch.plan));
      this.api.mpv.set('http-header-fields', safeHeaders(launch.plan.headers));
      this.api.mpv.set('file-local-options/force-media-title', mediaTitle(launch.display));
      this.api.mpv.set('stream-open-filename', launch.plan.url);
      if (launch.plan.externalSubtitle !== undefined) {
        try {
          await this.downloadExternalSubtitle(launch, loadSequence, generation);
          if (
            loadSequence !== this.loadSequence ||
            this.launch !== launch ||
            this.session.generation !== generation
          ) {
            return;
          }
        } catch (error) {
          if (error instanceof StalePlayerLoadError || loadSequence !== this.loadSequence) return;
          this.logger.warn('Could not download the selected Jellyfin subtitle', error);
          this.api.core.osd('The selected subtitle could not be loaded. Playback will continue.');
          this.deleteExternalSubtitle();
        }
      }
      this.logger.info('player.media.opening', {
        correlation: launch.diagnosticCorrelation,
        playMethod: launch.plan.playMethod,
      });
      this.publishState();
    } catch (error) {
      if (error instanceof StalePlayerLoadError || loadSequence !== this.loadSequence) return;
      this.logger.error('Could not prepare Jellyfin playback', error);
      this.api.core.osd('Jellyfin playback could not be prepared.');
      const failedLaunch = this.launch;
      if (failedLaunch !== undefined) {
        const generation = this.session.generation;
        this.session = reducePlaybackSession(this.session, {
          type: 'fail',
          generation,
          positionTicks: this.session.positionTicks,
          message: 'Jellyfin playback preparation failed.',
        });
        const report = this.sendReport('stopped');
        try {
          this.publishState();
          this.api.mpv.set('stream-open-filename', 'null://');
        } finally {
          this.cleanupPlaybackIfOwned(failedLaunch, generation);
        }
        await report;
      } else {
        this.clearMediaCredentials();
        this.deleteExternalSubtitle();
        this.scrubPlaybackSecrets();
        this.api.mpv.set('stream-open-filename', 'null://');
      }
    } finally {
      next?.();
    }
  }

  private async downloadExternalSubtitle(
    launch: PlayerLaunch,
    loadSequence: number,
    generation: number,
  ): Promise<void> {
    const subtitle = launch.plan.externalSubtitle;
    if (subtitle === undefined) return;
    const extension = safeSubtitleExtension(subtitle.codec);
    const destination = `@tmp/jellyfin-subtitle-${safeTemporaryNameComponent(launch.nonce)}-${generation}-${loadSequence}.${extension}`;
    try {
      await this.transport.download(
        {
          method: 'GET',
          url: subtitle.deliveryUrl,
          headers: launch.plan.headers,
        },
        destination,
      );
      const handle = this.api.file.handle(destination, 'read');
      try {
        handle.seekToEnd();
        if (handle.offset() > MAX_EXTERNAL_SUBTITLE_BYTES) {
          throw new Error('The selected external subtitle exceeds the 10 MiB safety limit.');
        }
      } finally {
        handle.close();
      }
      if (
        loadSequence !== this.loadSequence ||
        this.launch !== launch ||
        this.session.generation !== generation
      ) {
        throw new StalePlayerLoadError();
      }
      this.externalSubtitlePath = destination;
    } catch (error) {
      this.deleteSubtitlePath(destination);
      throw error;
    }
  }

  private async mediaLoaded(): Promise<void> {
    if (this.launch === undefined || this.session.status !== 'preparing') return;
    if (
      this.activeLoadReplacementSequence !== undefined &&
      this.activeLoadReplacementSequence !== this.replacementSequence
    ) {
      return;
    }
    const generation = this.session.generation;
    this.clearUpNext(true);
    const requestedLocalStartSeconds = localStartPositionSeconds(this.launch.plan);
    const loadedLocalPositionSeconds = this.api.mpv.getNumber('time-pos');
    const shouldCorrectLoadedPosition =
      !Number.isFinite(loadedLocalPositionSeconds) ||
      Math.abs(loadedLocalPositionSeconds - requestedLocalStartSeconds) > 1;
    if (shouldCorrectLoadedPosition) {
      this.api.core.seekTo(requestedLocalStartSeconds);
      this.logger.info('player.position.corrected', {
        correlation: this.launch.diagnosticCorrelation,
        resumed: this.launch.plan.startPositionTicks > 0,
      });
    }
    this.applySelectedTracks();
    this.loadExternalSubtitleTrack();
    this.session = reducePlaybackSession(this.session, {
      type: 'media-started',
      generation,
      // The initial mpv position can still describe stale watch-later state and
      // seekTo is asynchronous. Jellyfin's requested start is authoritative for
      // the start report; later progress reports use mpv's live position.
      positionTicks: this.launch.plan.startPositionTicks,
      durationTicks: this.readDurationTicks(),
    });
    // mpv can already be paused before iina.file-loaded is emitted. In that
    // ordering no later pause-change notification is guaranteed, so reconcile
    // the native flag before publishing the first loaded state.
    if (this.api.mpv.getFlag('pause')) {
      this.session = reducePlaybackSession(this.session, {
        type: 'pause',
        generation,
        positionTicks: this.session.positionTicks,
      });
    }
    this.logger.info('player.media.loaded', {
      correlation: this.launch.diagnosticCorrelation,
      playMethod: this.launch.plan.playMethod,
      resumed: this.launch.plan.startPositionTicks > 0,
    });
    // The catalog and player views should reflect native playback immediately;
    // Jellyfin reporting remains serialized but must not delay local UI state.
    this.publishState();
    if (this.startedGeneration !== generation) {
      this.startedGeneration = generation;
      await this.sendReport('start');
    }
  }

  private loadExternalSubtitleTrack(): void {
    const path = this.externalSubtitlePath;
    if (path === undefined) return;
    try {
      const resolved = this.api.utils.resolvePath(path);
      if (typeof resolved !== 'string' || !resolved.startsWith('/')) {
        throw new Error('IINA could not resolve the plugin-private subtitle path.');
      }
      this.api.core.subtitle.loadTrack(resolved);
    } catch (error) {
      this.logger.warn('Could not attach the selected Jellyfin subtitle', error);
      this.api.core.osd('The selected subtitle could not be attached.');
      this.deleteExternalSubtitle();
    }
  }

  private applySelectedTracks(): void {
    if (this.launch === undefined) return;
    const tracks = this.api.mpv.getNative<Array<Record<string, unknown>>>('track-list') ?? [];
    const select = (type: 'audio' | 'sub', streamIndex: number | undefined): void => {
      if (streamIndex === undefined || streamIndex < 0) {
        if (type === 'sub' && streamIndex === -1) this.api.mpv.set('sid', 'no');
        return;
      }
      const matched = tracks.find(
        (track) =>
          track.type === type &&
          (track['ff-index'] === streamIndex || track['ff-index'] === String(streamIndex)),
      );
      if (matched?.id !== undefined) this.api.mpv.set(type === 'audio' ? 'aid' : 'sid', matched.id);
    };
    select('audio', this.launch.plan.audioStreamIndex);
    select('sub', this.launch.plan.subtitleStreamIndex);
  }

  private readPositionTicks(): number {
    if (this.launch === undefined) return 0;
    const seconds = this.api.mpv.getNumber('time-pos');
    if (!Number.isFinite(seconds) || seconds < 0) {
      return clampPositionTicks(this.session.positionTicks, this.launch.plan.runtimeTicks);
    }
    const relative = secondsToTicks(seconds);
    return clampPositionTicks(this.positionBaseTicks + relative, this.launch.plan.runtimeTicks);
  }

  private handleEndFile(): void {
    const acknowledge = this.pendingCoreStopAcknowledgement;
    if (acknowledge !== undefined) {
      this.pendingCoreStopAcknowledgement = undefined;
      acknowledge();
      return;
    }
    if (this.replacementEndFilesToIgnore > 0) {
      this.replacementEndFilesToIgnore -= 1;
      return;
    }
    void this.ended();
  }

  private readDurationTicks(): number | undefined {
    if (this.launch?.plan.runtimeTicks !== undefined) return this.launch.plan.runtimeTicks;
    const seconds = this.api.mpv.getNumber('duration');
    return Number.isFinite(seconds) && seconds >= 0 ? secondsToTicks(seconds) : undefined;
  }

  private updatePosition(): void {
    if (this.launch === undefined) return;
    const update: Parameters<typeof reducePlaybackSession>[1] = {
      type: 'time-update',
      generation: this.session.generation,
      positionTicks: this.readPositionTicks(),
    };
    const duration = this.readDurationTicks();
    if (duration !== undefined) update.durationTicks = duration;
    this.session = reducePlaybackSession(this.session, update);
  }

  private async pauseChanged(): Promise<void> {
    if (
      this.launch === undefined ||
      (this.session.status !== 'playing' && this.session.status !== 'paused')
    ) {
      return;
    }
    this.updatePosition();
    const paused = this.api.mpv.getFlag('pause');
    this.session = reducePlaybackSession(this.session, {
      type: paused ? 'pause' : 'resume',
      generation: this.session.generation,
      positionTicks: this.session.positionTicks,
    });
    this.publishState();
    await this.sendReport('progress', paused ? 'pause' : 'unpause');
  }

  private async reportImmediate(eventName: PlaybackProgressEventName): Promise<void> {
    if (
      this.launch === undefined ||
      (this.session.status !== 'playing' && this.session.status !== 'paused')
    ) {
      return;
    }
    this.updatePosition();
    this.session = reducePlaybackSession(this.session, {
      type: 'seek',
      generation: this.session.generation,
      positionTicks: this.session.positionTicks,
    });
    this.publishState();
    await this.sendReport('progress', eventName);
  }

  private playbackTimingChanged(): void {
    if (
      this.launch === undefined ||
      (this.session.status !== 'playing' && this.session.status !== 'paused')
    ) {
      return;
    }
    this.updatePosition();
    this.publishState();
  }

  private async periodicProgress(): Promise<void> {
    if (
      this.launch !== undefined &&
      (this.session.status === 'preparing' || this.session.status === 'paused')
    ) {
      // Preparing and paused players do not send periodic Jellyfin progress
      // reports, but their heartbeat keeps live catalog status from expiring.
      if (this.session.status === 'paused') this.updatePosition();
      this.publishState();
      return;
    }
    if (!shouldReportPeriodicProgress(this.session, Date.now(), DEFAULT_PROGRESS_INTERVAL_MS))
      return;
    this.updatePosition();
    this.publishState();
    await this.sendReport('progress', 'timeupdate');
  }

  private async sendReport(
    kind: 'start' | 'progress' | 'stopped',
    eventName?: PlaybackProgressEventName,
  ): Promise<void> {
    const launch = this.launch;
    if (launch === undefined) return;
    const stateAtSend: PlaybackSessionState = {
      ...this.session,
      ...(this.session.plan === undefined ? {} : { plan: { ...this.session.plan } }),
    };
    const contextAtSend = { ...launch.context };
    const telemetry: Parameters<typeof buildPlaybackReportRequest>[3] = {
      canSeek: this.api.mpv.getFlag('seekable'),
      isMuted: this.api.mpv.getFlag('mute'),
      volumeLevel: this.api.mpv.getNumber('volume'),
      failed: stateAtSend.status === 'error',
    };
    if (eventName !== undefined) telemetry.eventName = eventName;

    const report = async (): Promise<void> => {
      try {
        const request = buildPlaybackReportRequest(kind, stateAtSend, contextAtSend, telemetry);
        await this.transport.execute(request);
        if (kind === 'progress' && this.session.generation === stateAtSend.generation) {
          this.session = reducePlaybackSession(this.session, {
            type: 'progress-reported',
            generation: stateAtSend.generation,
            atMs: Date.now(),
          });
        }
      } catch (error) {
        this.logger.warn(`Jellyfin playback ${kind} report failed`, error);
      }
    };
    const queued = this.reportQueue.then(report, report);
    this.reportQueue = queued;
    await queued;
  }

  private async ended(): Promise<void> {
    if (this.launch === undefined) return;
    if (
      this.session.status !== 'preparing' &&
      this.session.status !== 'playing' &&
      this.session.status !== 'paused'
    ) {
      return;
    }
    const launch = this.launch;
    this.updatePosition();
    const generation = this.session.generation;
    if (this.session.status === 'preparing') {
      this.session = reducePlaybackSession(this.session, {
        type: 'fail',
        generation,
        positionTicks: this.session.positionTicks,
        message: 'The Jellyfin media ended before IINA could load it.',
      });
      const report = this.sendReport('stopped');
      try {
        this.publishState();
      } finally {
        this.cleanupPlaybackIfOwned(launch, generation);
      }
      await report;
      return;
    }
    const duration = this.session.durationTicks;
    const completed =
      duration !== undefined &&
      duration > 0 &&
      this.session.positionTicks >= duration - secondsToTicks(2);
    this.session = completed
      ? reducePlaybackSession(this.session, {
          type: 'complete',
          generation,
          positionTicks: this.session.positionTicks,
        })
      : reducePlaybackSession(this.session, {
          type: 'stop',
          generation,
          positionTicks: this.session.positionTicks,
          reason: 'user',
        });
    this.logger.info('player.media.ended', {
      correlation: this.launch.diagnosticCorrelation,
      completed,
    });
    const report = this.sendReport('stopped');
    try {
      this.publishState();
    } finally {
      // Queue the immutable report first, then remove the old plan and credentials
      // synchronously. A newer launch can no longer be scrubbed when the network
      // request settles later.
      this.cleanupPlaybackIfOwned(launch, generation);
    }
    await report;
  }

  private async stop(reason: 'closed' | 'replaced' | 'user', closing: boolean): Promise<void> {
    this.discardPendingHandoffs();
    if (this.launch === undefined) {
      this.clearMediaCredentials();
      this.deleteExternalSubtitle();
      if (!closing) await this.stopCoreAndWaitForEnd();
      return;
    }
    const launch = this.launch;
    this.updatePosition();
    const generation = this.session.generation;
    const wasActive =
      this.session.status === 'preparing' ||
      this.session.status === 'playing' ||
      this.session.status === 'paused';
    this.logger.info('player.stop.requested', {
      correlation: this.launch.diagnosticCorrelation,
      reason,
      closing,
      wasActive,
    });
    this.session = reducePlaybackSession(this.session, {
      type: 'stop',
      generation,
      positionTicks: this.session.positionTicks,
      reason,
    });
    let endAcknowledgement: Promise<void> | undefined;
    if (!closing) {
      endAcknowledgement = this.stopCoreAndWaitForEnd();
    }
    const report = wasActive ? this.sendReport('stopped') : undefined;
    try {
      this.publishState();
    } finally {
      this.cleanupPlaybackIfOwned(launch, generation);
    }
    if (report !== undefined) await report;
    if (endAcknowledgement !== undefined) await endAcknowledgement;
  }

  private releaseForExternalLoad(): Promise<void> {
    const launch = this.launch;
    const generation = this.session.generation;
    let report: Promise<void> | undefined;
    try {
      if (launch !== undefined) {
        this.updatePosition();
        const wasActive =
          this.session.status === 'preparing' ||
          this.session.status === 'playing' ||
          this.session.status === 'paused';
        if (wasActive) {
          this.session = reducePlaybackSession(this.session, {
            type: 'stop',
            generation,
            positionTicks: this.session.positionTicks,
            reason: 'replaced',
          });
          report = this.sendReport('stopped');
          this.publishState();
        }
      }
    } finally {
      this.clearUpNext(true);
      if (launch !== undefined) this.cleanupPlaybackIfOwned(launch, generation);
    }
    if (report !== undefined) {
      void report.catch((error) => {
        this.logger.warn('Jellyfin playback stopped report failed during an external load', error);
      });
    }
    // Reporting remains serialized in reportQueue, but an unrelated local load
    // must not wait for a network round trip before its on_load hook can continue.
    return Promise.resolve();
  }

  private clearMediaCredentials(): void {
    this.api.mpv.set('http-header-fields', []);
  }

  private deleteExternalSubtitle(): void {
    const path = this.externalSubtitlePath;
    this.externalSubtitlePath = undefined;
    if (path === undefined) return;
    this.deleteSubtitlePath(path);
  }

  private deleteSubtitlePath(path: string): void {
    try {
      if (this.api.file.exists(path)) this.api.file.delete(path);
    } catch (error) {
      this.logger.warn('Could not remove a temporary Jellyfin subtitle', error);
    }
  }

  private stopCoreAndWaitForEnd(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.pendingCoreStopAcknowledgement === finish) {
          this.pendingCoreStopAcknowledgement = undefined;
        }
        resolve();
      };
      const timer = setTimeout(finish, CORE_STOP_ACK_TIMEOUT_MS);
      this.pendingCoreStopAcknowledgement = finish;
      try {
        this.api.core.stop();
      } catch {
        finish();
      }
    });
  }

  private enqueueControl(task: () => Promise<void>): void {
    const run = async (): Promise<void> => {
      try {
        await task();
      } catch (error) {
        this.logger.warn('Jellyfin player control failed', error);
      }
    };
    const queued = this.controlQueue.then(run, run);
    this.controlQueue = queued;
  }

  private beginLoad(): number {
    this.invalidatePendingLoads();
    return this.loadSequence;
  }

  private invalidatePendingLoads(): void {
    this.loadSequence += 1;
  }

  private discardPendingHandoffs(): void {
    this.pendingLaunchesForHook.length = 0;
  }

  private ensureProgressTimer(): void {
    if (this.progressTimer !== undefined) return;
    this.progressTimer = setInterval(
      () => void this.periodicProgress(),
      DEFAULT_PROGRESS_INTERVAL_MS,
    );
  }

  private clearProgressTimer(): void {
    if (this.progressTimer === undefined) return;
    clearInterval(this.progressTimer);
    this.progressTimer = undefined;
  }

  private cleanupPlaybackIfOwned(launch: PlayerLaunch, generation: number): void {
    if (this.launch !== launch || this.session.generation !== generation) return;
    try {
      this.clearMediaCredentials();
    } finally {
      this.deleteExternalSubtitle();
      this.scrubPlaybackSecrets();
    }
  }

  private scrubPlaybackSecrets(): void {
    const current = this.session;
    const scrubbed: PlaybackSessionState = {
      generation: current.generation,
      status: current.status,
      positionTicks: current.positionTicks,
    };
    if (current.durationTicks !== undefined) scrubbed.durationTicks = current.durationTicks;
    if (current.lastProgressReportAtMs !== undefined) {
      scrubbed.lastProgressReportAtMs = current.lastProgressReportAtMs;
    }
    if (current.stopReason !== undefined) scrubbed.stopReason = current.stopReason;
    if (current.errorMessage !== undefined) scrubbed.errorMessage = current.errorMessage;
    this.session = scrubbed;
    this.launch = undefined;
    this.activeLoadReplacementSequence = undefined;
  }

  private async replace(launch: PlayerLaunch, sequence: number): Promise<void> {
    if (sequence !== this.replacementSequence) return;
    this.clearUpNext(true);
    const coreWasIdle = this.api.core.status.idle;
    const hadActiveMedia = this.retireForReplacement();
    if (sequence !== this.replacementSequence) return;
    const replaceInsideMpv = hadActiveMedia || !coreWasIdle;
    if (replaceInsideMpv) this.replacementEndFilesToIgnore += 1;
    const pending = { launch, replacementSequence: sequence };
    this.pendingLaunchesForHook.push(pending);
    try {
      // IINA logs URLs passed to core.open. Open mpv's local null protocol and replace
      // stream-open-filename from the on_load hook so authenticated media URLs never
      // enter IINA's Open URL/authentication flow or its core-open diagnostics.
      if (replaceInsideMpv) {
        // PlayerCore.open closes an already-visible network player in IINA 1.4.4.
        // Replacing from mpv keeps the managed window alive while preserving the
        // same authenticated on_load handoff used for an initial/reopened core.
        this.api.mpv.command('loadfile', ['null://', 'replace']);
      } else {
        // A stopped/closed controlled core is idle, so the IINA API is required
        // here to reopen its native player window.
        this.api.core.open('null://');
      }
    } catch (error) {
      const pendingIndex = this.pendingLaunchesForHook.indexOf(pending);
      if (pendingIndex >= 0) this.pendingLaunchesForHook.splice(pendingIndex, 1);
      if (replaceInsideMpv) this.replacementEndFilesToIgnore -= 1;
      throw error;
    }
  }

  private retireForReplacement(): boolean {
    const launch = this.launch;
    if (launch === undefined) {
      this.clearMediaCredentials();
      this.deleteExternalSubtitle();
      return false;
    }
    this.updatePosition();
    const generation = this.session.generation;
    const wasActive =
      this.session.status === 'preparing' ||
      this.session.status === 'playing' ||
      this.session.status === 'paused';
    this.session = reducePlaybackSession(this.session, {
      type: 'stop',
      generation,
      positionTicks: this.session.positionTicks,
      reason: 'replaced',
    });
    const report = wasActive ? this.sendReport('stopped') : undefined;
    try {
      this.publishState();
    } finally {
      this.cleanupPlaybackIfOwned(launch, generation);
    }
    if (report !== undefined) {
      void report.catch((error) => {
        this.logger.warn('Jellyfin playback stopped report failed during replacement', error);
      });
    }
    return wasActive;
  }

  private publishState(): void {
    const display = this.launch?.display;
    const state = {
      generation: this.session.generation,
      status: this.session.status,
      positionTicks: this.session.positionTicks,
      durationTicks: this.session.durationTicks,
      title: display?.title,
      seriesName: display?.seriesName,
      seasonNumber: display?.seasonNumber,
      episodeNumber: display?.episodeNumber,
      playMethod: this.launch?.plan.playMethod,
      itemId: this.launch?.plan.itemId,
      stopReason: this.session.stopReason,
    };
    if (this.sidebarReady) this.api.sidebar.postMessage('player.state', state);
    if (this.overlayReady) this.api.overlay.postMessage('player.state', state);
    this.persistPublicPlaybackState();
  }

  private persistPublicPlaybackState(): void {
    const launch = this.launch;
    if (launch === undefined || this.session.status === 'idle') return;
    const state: PublicPlaybackState = {
      version: 1,
      playbackId: launch.nonce,
      sequence: ++this.playbackStateSequence,
      generation: this.session.generation,
      status: this.session.status,
      itemId: launch.plan.itemId,
      positionTicks: this.session.positionTicks,
      title: launch.display.title,
      playMethod: launch.plan.playMethod,
      startedAtMs: this.playbackStartedAtMs,
      updatedAtMs: Date.now(),
      isBuffering: this.api.mpv.getFlag('paused-for-cache'),
    };
    const playbackRate = this.api.mpv.getNumber('speed');
    if (Number.isFinite(playbackRate) && playbackRate >= 0.01 && playbackRate <= 100) {
      state.playbackRate = playbackRate;
    }
    if (this.session.durationTicks !== undefined) state.durationTicks = this.session.durationTicks;
    if (launch.display.seriesName !== undefined) state.seriesName = launch.display.seriesName;
    if (launch.display.seasonNumber !== undefined) {
      state.seasonNumber = launch.display.seasonNumber;
    }
    if (launch.display.episodeNumber !== undefined) {
      state.episodeNumber = launch.display.episodeNumber;
    }
    if (this.session.stopReason !== undefined) state.stopReason = this.session.stopReason;

    try {
      writePlaybackState(this.api.file, state);
      this.playbackStatePersistenceFailed = false;
    } catch (error) {
      if (this.playbackStatePersistenceFailed) return;
      this.playbackStatePersistenceFailed = true;
      this.logger.warn('Could not publish playback state to the Jellyfin catalog', error);
    }
  }

  private receiveUpNext(raw: unknown): void {
    if (raw === null || typeof raw !== 'object') return;
    const candidate = raw as { item?: unknown; countdownSeconds?: unknown; autoplay?: unknown };
    const item = BaseItemSchema.safeParse(candidate.item);
    if (!item.success) return;
    const countdownSeconds =
      typeof candidate.countdownSeconds === 'number' && candidate.countdownSeconds >= 1
        ? Math.min(60, Math.floor(candidate.countdownSeconds))
        : 10;
    const next: UpNextState = {
      itemId: item.data.Id,
      title: item.data.Name,
      remainingSeconds: countdownSeconds,
      autoplay: candidate.autoplay === true,
    };
    if (item.data.SeriesName != null) next.seriesName = item.data.SeriesName;
    if (item.data.ParentIndexNumber != null) next.seasonNumber = item.data.ParentIndexNumber;
    if (item.data.IndexNumber != null) next.episodeNumber = item.data.IndexNumber;
    this.upNext = next;
    this.publishUpNext();
    if (this.overlayReady) this.api.overlay.show();

    this.updateUpNextTimer();
  }

  private updateUpNextTimer(): void {
    if (this.upNextTimer !== undefined) clearInterval(this.upNextTimer);
    this.upNextTimer = undefined;
    if (this.upNext?.autoplay !== true) return;
    this.upNextTimer = setInterval(() => {
      if (this.upNext === undefined || !this.upNext.autoplay) return;
      this.upNext.remainingSeconds -= 1;
      if (this.upNext.remainingSeconds <= 0) {
        const itemId = this.upNext.itemId;
        this.clearUpNext(true);
        this.api.global.postMessage(PLAYER_MESSAGES.playNext, { itemId });
        return;
      }
      this.publishUpNext();
    }, 1_000);
  }

  private publishUpNext(): void {
    if (this.upNext === undefined) return;
    if (this.sidebarReady) this.api.sidebar.postMessage('player.upNext', this.upNext);
    if (this.overlayReady) this.api.overlay.postMessage('player.upNext', this.upNext);
  }

  private clearUpNext(hideOverlay: boolean): void {
    if (this.upNextTimer !== undefined) clearInterval(this.upNextTimer);
    this.upNextTimer = undefined;
    this.upNext = undefined;
    if (this.sidebarReady) this.api.sidebar.postMessage('player.upNext', null);
    if (this.overlayReady) {
      this.api.overlay.postMessage('player.upNext', null);
      if (hideOverlay) this.api.overlay.hide();
    }
  }

  private loadPlayerViews(): void {
    this.api.sidebar.loadFile('dist/ui/sidebar/index.html');
    this.sidebarReady = true;
    this.api.overlay.loadFile('dist/ui/overlay/index.html');
    this.api.overlay.setClickable(true);
    this.overlayReady = true;
    this.publishState();
  }

  private handleViewAction(raw: unknown, source: 'sidebar' | 'overlay'): void {
    if (raw === null || typeof raw !== 'object') return;
    const action = (raw as { action?: unknown }).action;
    if (action === 'host.ready') {
      this.publishState();
      this.publishUpNext();
    } else if (action === 'window.openCatalog') {
      this.api.preferences.set(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, Date.now());
      this.api.preferences.sync();
    } else if (action === 'settings.autoplay') {
      const enabled = (raw as { enabled?: unknown }).enabled;
      if (typeof enabled === 'boolean') {
        this.api.preferences.set('autoplayNextEpisode', enabled);
        this.api.preferences.sync();
        if (this.upNext !== undefined) {
          this.upNext.autoplay = enabled;
          this.updateUpNextTimer();
          this.publishUpNext();
        }
      }
    } else if (action === 'player.pause') {
      this.api.core.pause();
    } else if (action === 'player.resume') {
      this.api.core.resume();
    } else if (action === 'upNext.cancel') {
      this.clearUpNext(true);
    } else if (action === 'upNext.playNow' && this.upNext !== undefined) {
      const itemId = this.upNext.itemId;
      this.clearUpNext(true);
      this.api.global.postMessage(PLAYER_MESSAGES.playNext, { itemId });
    }
    const view = source === 'sidebar' ? this.api.sidebar : this.api.overlay;
    view.postMessage('host.response', { action, ok: true });
  }
}

export {
  localStartPositionSeconds,
  parseAutoSkipChapterTitles,
  safeHeaders,
  safeSubtitleExtension,
  transcodeStartOffset,
};
