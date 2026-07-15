import {
  BaseItemSchema,
  PlaybackPlanSchema,
  beginPlaybackSession,
  buildPlaybackReportRequest,
  clampPositionTicks,
  createIdlePlaybackSession,
  reducePlaybackSession,
  secondsToTicks,
  shouldReportPeriodicProgress,
  ticksToSeconds,
  type PlaybackProgressEventName,
  type PlaybackSessionState,
} from '@iina-jellyfin/core';
import { DEFAULT_PROGRESS_INTERVAL_MS, PLAYER_MESSAGES, PLUGIN_PLAYBACK_SCHEME } from './constants';
import type { IinaHttpTransport } from './iina-http';
import type { PlayerLaunch } from './player-messages';
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

interface LaunchResolver {
  resolve: (launch: PlayerLaunch) => void;
  reject: (error: Error) => void;
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

function nonceFromPlaybackUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== PLUGIN_PLAYBACK_SCHEME || parsed.hostname !== 'play') return undefined;
    const nonce = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return nonce.length > 0 ? nonce : undefined;
  } catch {
    return undefined;
  }
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

function transcodeStartOffset(plan: PlayerLaunch['plan']): number {
  if (plan.playMethod === 'DirectPlay') return 0;
  try {
    const url = new URL(plan.url);
    for (const [name, value] of url.searchParams) {
      if (name.toLowerCase() === 'starttimeticks') {
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
      }
    }
  } catch {
    // The plan schema already validates URLs. Falling back keeps reporting safe.
  }
  // Without an explicit server offset, mpv still needs to seek locally.
  return 0;
}

export class PlayerRuntime {
  private session: PlaybackSessionState = createIdlePlaybackSession();
  private launch: PlayerLaunch | undefined;
  private readonly resolvers = new Map<string, LaunchResolver>();
  private startedGeneration = -1;
  private positionBaseTicks = 0;
  private progressTimer: ReturnType<typeof setInterval> | undefined;
  private sidebarReady = false;
  private overlayReady = false;
  private upNext: UpNextState | undefined;
  private upNextTimer: ReturnType<typeof setInterval> | undefined;
  private closedNotificationSent = false;
  private externalSubtitlePath: string | undefined;
  private reportQueue: Promise<void> = Promise.resolve();
  private controlQueue: Promise<void> = Promise.resolve();
  private replacementSequence = 0;
  private replacementEndFilesToIgnore = 0;
  private pendingCoreStopAcknowledgement: (() => void) | undefined;
  private loadSequence = 0;

  constructor(
    private readonly api: PlayerApi,
    private readonly transport: IinaHttpTransport,
    private readonly logger: SafeLogger,
  ) {}

  install(): void {
    this.api.global.onMessage(PLAYER_MESSAGES.plan, (raw) => this.receiveLaunch(raw));
    this.api.global.onMessage(PLAYER_MESSAGES.replace, (raw) => {
      const nonce = (raw as { nonce?: unknown }).nonce;
      if (typeof nonce === 'string') {
        const sequence = ++this.replacementSequence;
        this.invalidatePendingLoads();
        this.enqueueControl(() => this.replace(nonce, sequence));
      }
    });
    this.api.global.onMessage(PLAYER_MESSAGES.stop, (raw) => {
      const requested = (raw as { reason?: unknown }).reason;
      const reason = requested === 'closed' || requested === 'replaced' ? requested : 'user';
      this.replacementSequence += 1;
      this.invalidatePendingLoads();
      this.enqueueControl(() => this.stop(reason, false));
    });
    this.api.global.onMessage(PLAYER_MESSAGES.upNext, (raw) => this.receiveUpNext(raw));

    this.api.mpv.addHook('on_load', 90, (next) => {
      void this.resolveLoad(next);
    });

    this.api.event.on('iina.window-loaded', () => this.loadPlayerViews());
    this.api.event.on('iina.file-loaded', () => void this.mediaLoaded());
    this.api.event.on('mpv.pause.changed', () => void this.pauseChanged());
    this.api.event.on('mpv.seek', () => void this.reportImmediate('seek'));
    this.api.event.on('mpv.end-file', () => {
      this.handleEndFile();
    });
    this.api.event.on('iina.window-will-close', () => {
      if (this.progressTimer !== undefined) clearInterval(this.progressTimer);
      this.replacementSequence += 1;
      this.invalidatePendingLoads();
      this.enqueueControl(() => this.stop('closed', true));
    });

    this.api.sidebar.onMessage('host.action', (data) => this.handleViewAction(data, 'sidebar'));
    this.api.overlay.onMessage('host.action', (data) => this.handleViewAction(data, 'overlay'));

    this.progressTimer = setInterval(
      () => void this.periodicProgress(),
      DEFAULT_PROGRESS_INTERVAL_MS,
    );
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
    const resolver = this.resolvers.get(launch.nonce);
    if (resolver !== undefined) {
      this.resolvers.delete(launch.nonce);
      resolver.resolve(launch);
    }
  }

  private requestLaunch(nonce: string): Promise<PlayerLaunch> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.resolvers.delete(nonce);
        reject(new Error('The Jellyfin playback plan timed out.'));
      }, 12_000);
      this.resolvers.set(nonce, {
        resolve: (launch) => {
          clearTimeout(timer);
          resolve(launch);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.api.global.postMessage(PLAYER_MESSAGES.planRequest, { nonce });
    });
  }

  private async resolveLoad(next?: () => void): Promise<void> {
    const original = this.api.mpv.getString('stream-open-filename');
    const nonce = nonceFromPlaybackUrl(original);
    if (nonce === undefined) {
      this.invalidatePendingLoads();
      await this.releaseForExternalLoad();
      next?.();
      return;
    }

    const loadSequence = this.beginLoad();
    this.deleteExternalSubtitle();
    try {
      const launch = await this.requestLaunch(nonce);
      if (loadSequence !== this.loadSequence) return;
      this.launch = launch;
      this.session = beginPlaybackSession(this.session, launch.plan);
      const generation = this.session.generation;
      this.positionBaseTicks = transcodeStartOffset(launch.plan);
      this.api.mpv.set('http-header-fields', safeHeaders(launch.plan.headers));
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
      this.publishState();
    } catch (error) {
      if (error instanceof StalePlayerLoadError || loadSequence !== this.loadSequence) return;
      this.logger.error('Could not prepare Jellyfin playback', error);
      this.api.core.osd('Jellyfin playback could not be prepared.');
      if (this.launch !== undefined) {
        this.session = reducePlaybackSession(this.session, {
          type: 'fail',
          generation: this.session.generation,
          positionTicks: this.session.positionTicks,
          message: 'Jellyfin playback preparation failed.',
        });
        await this.sendReport('stopped');
        this.publishState();
      }
      this.clearMediaCredentials();
      this.deleteExternalSubtitle();
      this.scrubPlaybackSecrets();
      this.api.mpv.set('stream-open-filename', 'null://');
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
    const destination = `@tmp/jellyfin-subtitle-${generation}-${loadSequence}.${extension}`;
    await this.transport.download(
      {
        method: 'GET',
        url: subtitle.deliveryUrl,
        headers: launch.plan.headers,
      },
      destination,
    );
    try {
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
    const generation = this.session.generation;
    this.clearUpNext(true);
    const shouldSeekLocally =
      this.positionBaseTicks === 0 && this.launch.plan.startPositionTicks > 0;
    if (shouldSeekLocally) {
      this.api.core.seekTo(ticksToSeconds(this.launch.plan.startPositionTicks));
    }
    this.applySelectedTracks();
    this.loadExternalSubtitleTrack();
    this.session = reducePlaybackSession(this.session, {
      type: 'media-started',
      generation,
      positionTicks: shouldSeekLocally
        ? Math.max(this.launch.plan.startPositionTicks, this.readPositionTicks())
        : this.readPositionTicks(),
      durationTicks: this.readDurationTicks(),
    });
    if (this.startedGeneration !== generation) {
      this.startedGeneration = generation;
      await this.sendReport('start');
    }
    this.publishState();
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
    await this.sendReport('progress', paused ? 'pause' : 'unpause');
    this.publishState();
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
    await this.sendReport('progress', eventName);
    this.publishState();
  }

  private async periodicProgress(): Promise<void> {
    if (!shouldReportPeriodicProgress(this.session, Date.now(), DEFAULT_PROGRESS_INTERVAL_MS))
      return;
    this.updatePosition();
    await this.sendReport('progress', 'timeupdate');
    this.publishState();
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
    this.updatePosition();
    const generation = this.session.generation;
    if (this.session.status === 'preparing') {
      this.session = reducePlaybackSession(this.session, {
        type: 'fail',
        generation,
        positionTicks: this.session.positionTicks,
        message: 'The Jellyfin media ended before IINA could load it.',
      });
      await this.sendReport('stopped');
      this.publishState();
      this.clearMediaCredentials();
      this.deleteExternalSubtitle();
      this.scrubPlaybackSecrets();
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
    await this.sendReport('stopped');
    this.publishState();
    this.clearMediaCredentials();
    this.deleteExternalSubtitle();
    this.scrubPlaybackSecrets();
  }

  private async stop(reason: 'closed' | 'replaced' | 'user', closing: boolean): Promise<void> {
    if (closing && !this.closedNotificationSent) {
      this.closedNotificationSent = true;
      this.api.global.postMessage(PLAYER_MESSAGES.closed, {
        generation: this.session.generation,
      });
    }
    if (this.launch === undefined) {
      this.clearMediaCredentials();
      this.deleteExternalSubtitle();
      if (!closing) await this.stopCoreAndWaitForEnd();
      return;
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
      reason,
    });
    this.publishState();
    let endAcknowledgement: Promise<void> | undefined;
    if (!closing) {
      endAcknowledgement = this.stopCoreAndWaitForEnd();
    }
    if (wasActive) await this.sendReport('stopped');
    if (endAcknowledgement !== undefined) await endAcknowledgement;
    this.clearMediaCredentials();
    this.deleteExternalSubtitle();
    this.scrubPlaybackSecrets();
  }

  private async releaseForExternalLoad(): Promise<void> {
    if (this.launch !== undefined) {
      this.updatePosition();
      const generation = this.session.generation;
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
        await this.sendReport('stopped');
        this.publishState();
      }
    }
    this.clearUpNext(true);
    this.clearMediaCredentials();
    this.deleteExternalSubtitle();
    this.scrubPlaybackSecrets();
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
    const error = new StalePlayerLoadError();
    for (const resolver of this.resolvers.values()) resolver.reject(error);
    this.resolvers.clear();
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
  }

  private async replace(nonce: string, sequence: number): Promise<void> {
    if (sequence !== this.replacementSequence) return;
    this.clearUpNext(true);
    const hadActiveMedia = this.retireForReplacement();
    if (sequence !== this.replacementSequence) return;
    if (hadActiveMedia) this.replacementEndFilesToIgnore += 1;
    try {
      this.api.core.open(`${PLUGIN_PLAYBACK_SCHEME}//play/${encodeURIComponent(nonce)}`);
    } catch (error) {
      if (hadActiveMedia) this.replacementEndFilesToIgnore -= 1;
      throw error;
    }
  }

  private retireForReplacement(): boolean {
    if (this.launch === undefined) {
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
    this.publishState();
    if (wasActive) void this.sendReport('stopped');
    this.clearMediaCredentials();
    this.deleteExternalSubtitle();
    this.scrubPlaybackSecrets();
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
    this.api.global.postMessage(PLAYER_MESSAGES.state, state);
    if (this.sidebarReady) this.api.sidebar.postMessage('player.state', state);
    if (this.overlayReady) this.api.overlay.postMessage('player.state', state);
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
      this.api.global.postMessage(PLAYER_MESSAGES.catalogOpen, {});
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

export { nonceFromPlaybackUrl, safeHeaders, safeSubtitleExtension, transcodeStartOffset };
