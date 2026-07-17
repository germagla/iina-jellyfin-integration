import { describe, expect, it, vi } from 'vitest';
import type { PlaybackPlan, PlaybackSessionState } from '@iina-jellyfin/core';
import {
  localStartPositionSeconds,
  PlayerRuntime,
  safeHeaders,
  safeSubtitleExtension,
  transcodeStartOffset,
} from '../src/player-runtime';
import type { PlayerLaunch } from '../src/player-messages';

const plan: PlaybackPlan = {
  itemId: 'item-1',
  playSessionId: 'play-session-1',
  mediaSourceId: 'source-1',
  url: 'https://media.test/Videos/item-1/stream',
  headers: { Authorization: 'MediaBrowser Token="secret"' },
  playMethod: 'DirectPlay',
  conversion: 'none',
  requiresVideoTranscodeConfirmation: false,
  transcodeReasons: [],
  startPositionTicks: 0,
  runtimeTicks: 600_000_000,
};

const launch: PlayerLaunch = {
  nonce: 'play-1',
  plan,
  context: {
    serverUrl: 'https://media.test',
    userId: 'user-1',
    accessToken: 'secret',
    deviceId: 'device-1',
    version: '0.1.0',
  },
  display: { title: 'Test Movie' },
};

function createRuntime() {
  const loadTrack = vi.fn();
  const deleteFile = vi.fn();
  const execute = vi.fn<
    (request: { url: string; body?: Record<string, unknown> }) => Promise<unknown>
  >(async () => ({}));
  const api = {
    core: {
      osd: vi.fn(),
      seekTo: vi.fn(),
      stop: vi.fn(),
      open: vi.fn(),
      status: { idle: true },
      subtitle: { loadTrack },
    },
    file: {
      exists: vi.fn(() => true),
      delete: deleteFile,
      write: vi.fn(),
      handle: vi.fn(() => ({
        seekToEnd: vi.fn(),
        offset: vi.fn(() => 100),
        close: vi.fn(),
      })),
    },
    global: {
      getLabel: vi.fn(() => launch.nonce),
      onMessage: vi.fn(),
      postMessage: vi.fn(),
    },
    event: { on: vi.fn() },
    mpv: {
      addHook: vi.fn(),
      getString: vi.fn(() => ''),
      getNumber: vi.fn((name: string): number =>
        name === 'duration' ? 60 : name === 'speed' ? 1 : 0,
      ),
      getFlag: vi.fn(() => false),
      getNative: vi.fn(() => []),
      set: vi.fn(),
      command: vi.fn(),
    },
    preferences: { get: vi.fn(), set: vi.fn(), sync: vi.fn() },
    sidebar: { loadFile: vi.fn(), onMessage: vi.fn(), postMessage: vi.fn() },
    overlay: {
      loadFile: vi.fn(),
      onMessage: vi.fn(),
      postMessage: vi.fn(),
      hide: vi.fn(),
      show: vi.fn(),
      setClickable: vi.fn(),
    },
    utils: { resolvePath: vi.fn(() => '/private/tmp/jellyfin-subtitle.srt') },
  };
  const transport = {
    execute,
    download: vi.fn<(request: unknown, destination: string) => Promise<void>>(
      async () => undefined,
    ),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return {
    runtime: new PlayerRuntime(api as never, transport as never, logger as never),
    api,
    transport,
    logger,
    loadTrack,
    deleteFile,
  };
}

function seedSession(
  runtime: PlayerRuntime,
  status: PlaybackSessionState['status'],
  externalSubtitlePath?: string,
): void {
  const internals = runtime as unknown as {
    launch: PlayerLaunch;
    session: PlaybackSessionState;
    externalSubtitlePath?: string;
  };
  internals.launch = launch;
  internals.session = {
    generation: 1,
    status,
    plan,
    positionTicks: 0,
    durationTicks: plan.runtimeTicks,
  };
  if (externalSubtitlePath !== undefined) internals.externalSubtitlePath = externalSubtitlePath;
}

describe('player runtime boundaries', () => {
  it('installs launch handlers without relying on IINA child-to-global messaging', () => {
    vi.useFakeTimers();
    try {
      const { runtime, api } = createRuntime();

      runtime.install();

      expect(api.global.onMessage).toHaveBeenCalled();
      expect(api.global.postMessage).not.toHaveBeenCalledWith(
        'jellyfin.player.ready',
        expect.anything(),
      );
      clearInterval(
        (runtime as unknown as { progressTimer: ReturnType<typeof setInterval> }).progressTimer,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens only mpv null and installs the authenticated stream from on_load', async () => {
    const { runtime, api } = createRuntime();
    const internals = runtime as unknown as {
      receiveLaunch(value: unknown): void;
      progressTimer: ReturnType<typeof setInterval>;
    };
    runtime.install();
    api.mpv.getString.mockReturnValue('null://');

    internals.receiveLaunch(launch);
    await vi.waitFor(() => expect(api.core.open).toHaveBeenCalledWith('null://'));
    const next = vi.fn();
    const registered = api.mpv.addHook.mock.calls.find(([name]) => name === 'on_load');
    const hook = registered?.[2] as ((next: () => void) => Promise<void>) | undefined;
    expect(hook).toBeTypeOf('function');
    const pendingHook = hook?.(next);
    expect(pendingHook).toBeInstanceOf(Promise);
    await pendingHook;

    expect(api.core.open).not.toHaveBeenCalledWith(plan.url);
    expect(api.mpv.command).not.toHaveBeenCalledWith('loadfile', ['null://', 'replace']);
    expect(api.mpv.set).toHaveBeenCalledWith('file-local-options/resume-playback', false);
    expect(api.mpv.set).toHaveBeenCalledWith('file-local-options/save-position-on-quit', false);
    expect(api.mpv.set).toHaveBeenCalledWith('file-local-options/start', 0);
    expect(api.mpv.set).toHaveBeenCalledWith('http-header-fields', [
      'Authorization: MediaBrowser Token="secret"',
    ]);
    expect(api.mpv.set).toHaveBeenCalledWith('stream-open-filename', plan.url);
    expect(JSON.parse(api.file.write.mock.calls[0]?.[1] as string)).toMatchObject({
      playbackId: launch.nonce,
      status: 'preparing',
    });
    const resumeOptionIndex = api.mpv.set.mock.calls.findIndex(
      ([name]) => name === 'file-local-options/resume-playback',
    );
    const streamUrlIndex = api.mpv.set.mock.calls.findIndex(
      ([name]) => name === 'stream-open-filename',
    );
    expect(resumeOptionIndex).toBeGreaterThanOrEqual(0);
    expect(streamUrlIndex).toBeGreaterThan(resumeOptionIndex);
    expect(next).toHaveBeenCalledOnce();
    clearInterval(internals.progressTimer);
  });

  it('publishes a bounded secret-free playback snapshot for the standalone catalog', () => {
    const { runtime, api } = createRuntime();
    seedSession(runtime, 'playing');
    const internals = runtime as unknown as { publishState(): void };

    internals.publishState();

    expect(api.file.write).toHaveBeenCalledOnce();
    const [path, raw] = api.file.write.mock.calls[0] as [string, string];
    expect(path).toBe('@tmp/jellyfin-playback-state-play-1.json');
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      playbackId: 'play-1',
      itemId: 'item-1',
      status: 'playing',
      title: 'Test Movie',
      playMethod: 'DirectPlay',
      playbackRate: 1,
      isBuffering: false,
    });
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('Authorization');
    expect(raw).not.toContain('https://');
  });

  it('heartbeats preparing playback without sending a premature Jellyfin progress report', async () => {
    const { runtime, api, transport } = createRuntime();
    seedSession(runtime, 'preparing');

    await (runtime as unknown as { periodicProgress(): Promise<void> }).periodicProgress();

    expect(api.file.write).toHaveBeenCalledOnce();
    expect(JSON.parse(api.file.write.mock.calls[0]?.[1] as string)).toMatchObject({
      playbackId: launch.nonce,
      status: 'preparing',
    });
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it('drops header injection attempts', () => {
    expect(
      safeHeaders({
        Authorization: 'MediaBrowser Token="safe"',
        'Bad Header': 'x',
        Good: 'x\r\ny',
      }),
    ).toEqual(['Authorization: MediaBrowser Token="safe"']);
  });

  it('limits subtitle extensions to formats IINA can safely load', () => {
    expect(safeSubtitleExtension('ass')).toBe('ass');
    expect(safeSubtitleExtension('../../command')).toBe('srt');
  });

  it('uses the server transcode start offset for position reporting', () => {
    expect(
      transcodeStartOffset({
        itemId: 'item',
        playSessionId: 'session',
        mediaSourceId: 'source',
        url: 'https://media.test/Videos/item/master.m3u8?StartTimeTicks=120000000',
        headers: {},
        playMethod: 'Transcode',
        conversion: 'video',
        requiresVideoTranscodeConfirmation: true,
        transcodeReasons: [],
        startPositionTicks: 120_000_000,
      }),
    ).toBe(120_000_000);
  });

  it('uses the server start offset for direct streams without seeking twice', () => {
    expect(
      transcodeStartOffset({
        itemId: 'item',
        playSessionId: 'session',
        mediaSourceId: 'source',
        url: 'https://media.test/Videos/item/stream?StartTimeTicks=120000000',
        headers: {},
        playMethod: 'DirectStream',
        conversion: 'container',
        requiresVideoTranscodeConfirmation: false,
        transcodeReasons: [],
        startPositionTicks: 120_000_000,
      }),
    ).toBe(120_000_000);
  });

  it('locally seeks a direct stream when its URL has no server start offset', () => {
    expect(
      transcodeStartOffset({
        itemId: 'item',
        playSessionId: 'session',
        mediaSourceId: 'source',
        url: 'https://media.test/Videos/item/stream',
        headers: {},
        playMethod: 'DirectStream',
        conversion: 'container',
        requiresVideoTranscodeConfirmation: false,
        transcodeReasons: [],
        startPositionTicks: 120_000_000,
      }),
    ).toBe(0);
  });

  it('derives a local start only for ticks not already applied by the server', () => {
    expect(localStartPositionSeconds({ ...plan, startPositionTicks: 120_000_000 })).toBe(12);
    expect(
      localStartPositionSeconds({
        ...plan,
        playMethod: 'DirectStream',
        conversion: 'container',
        startPositionTicks: 120_000_000,
        url: 'https://media.test/Videos/item/stream?StartTimeTicks=120000000',
      }),
    ).toBe(0);
  });

  it("preserves an ordinary player's HTTP headers when no Jellyfin load is owned", async () => {
    const set = vi.fn();
    const next = vi.fn();
    const runtime = new PlayerRuntime(
      {
        mpv: {
          getString: () => 'https://unrelated.example/video.mp4',
          set,
        },
      } as never,
      {} as never,
      { warn: vi.fn() } as never,
    );

    await (runtime as unknown as { resolveLoad(next?: () => void): Promise<void> }).resolveLoad(
      next,
    );

    expect(set).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('always acknowledges an external load even if Jellyfin cleanup fails', async () => {
    const { runtime, api, logger, deleteFile } = createRuntime();
    seedSession(runtime, 'playing', '@tmp/owned-subtitle.srt');
    api.mpv.getString.mockReturnValue('https://unrelated.example/video.mp4');
    const next = vi.fn();
    const cleanupError = new Error('cleanup failed');
    const internals = runtime as unknown as {
      launch?: PlayerLaunch;
      releaseForExternalLoad(): Promise<void>;
      resolveLoad(next?: () => void): Promise<void>;
    };
    internals.releaseForExternalLoad = vi.fn(async () => {
      throw cleanupError;
    });

    await internals.resolveLoad(next);

    expect(next).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      'Could not release Jellyfin playback for an external load',
      cleanupError,
    );
    expect(api.mpv.set).toHaveBeenCalledWith('http-header-fields', []);
    expect(deleteFile).toHaveBeenCalledWith('@tmp/owned-subtitle.srt');
    expect(internals.launch).toBeUndefined();
  });

  it('does not delay an unrelated load while the stopped report is in flight', async () => {
    const { runtime, api, transport } = createRuntime();
    seedSession(runtime, 'playing');
    api.mpv.getString.mockReturnValue('https://unrelated.example/video.mp4');
    let finishReport: (() => void) | undefined;
    transport.execute.mockImplementationOnce(
      () => new Promise<unknown>((resolve) => (finishReport = () => resolve({}))),
    );
    const next = vi.fn();
    const internals = runtime as unknown as {
      launch?: PlayerLaunch;
      reportQueue: Promise<void>;
      resolveLoad(next?: () => void): Promise<void>;
    };

    await internals.resolveLoad(next);

    expect(next).toHaveBeenCalledOnce();
    expect(api.mpv.set).toHaveBeenCalledWith('http-header-fields', []);
    expect(internals.launch).toBeUndefined();
    await vi.waitFor(() => expect(transport.execute).toHaveBeenCalledOnce());
    finishReport?.();
    await internals.reportQueue;
  });

  it('reports playback start and attaches a resolved temporary subtitle only after file-loaded', async () => {
    const { runtime, transport, loadTrack } = createRuntime();
    seedSession(runtime, 'preparing', '@tmp/jellyfin-subtitle-1.srt');

    expect(transport.execute).not.toHaveBeenCalled();
    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(loadTrack).toHaveBeenCalledWith('/private/tmp/jellyfin-subtitle.srt');
    expect(transport.execute).toHaveBeenCalledTimes(1);
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing',
      body: { ItemId: 'item-1' },
    });
  });

  it('publishes playing state before a delayed Jellyfin start report settles', async () => {
    const { runtime, transport, api } = createRuntime();
    seedSession(runtime, 'preparing');
    let finishReport: (() => void) | undefined;
    transport.execute.mockImplementationOnce(
      () => new Promise<unknown>((resolve) => (finishReport = () => resolve({}))),
    );

    const loading = (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.file.write).toHaveBeenCalledOnce();
    expect(JSON.parse(api.file.write.mock.calls[0]?.[1] as string)).toMatchObject({
      status: 'playing',
      itemId: 'item-1',
    });
    await vi.waitFor(() => expect(transport.execute).toHaveBeenCalledOnce());
    finishReport?.();
    await loading;
  });

  it('publishes paused when mpv is already paused before file-loaded', async () => {
    const { runtime, transport, api } = createRuntime();
    seedSession(runtime, 'preparing');
    api.mpv.getFlag.mockReturnValue(true);

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(JSON.parse(api.file.write.mock.calls[0]?.[1] as string)).toMatchObject({
      status: 'paused',
      itemId: 'item-1',
    });
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing',
      body: { IsPaused: true },
    });
  });

  it('corrects stale mpv state to the requested resume position before reporting start', async () => {
    const { runtime, transport, api } = createRuntime();
    const resumePlan = { ...plan, startPositionTicks: 120_000_000 };
    const resumeLaunch = { ...launch, plan: resumePlan };
    const internals = runtime as unknown as {
      launch: PlayerLaunch;
      session: PlaybackSessionState;
    };
    internals.launch = resumeLaunch;
    internals.session = {
      generation: 1,
      status: 'preparing',
      plan: resumePlan,
      positionTicks: resumePlan.startPositionTicks,
      durationTicks: resumePlan.runtimeTicks,
    };
    api.mpv.getNumber.mockImplementation((name: string) =>
      name === 'time-pos' ? 1_800 : name === 'duration' ? 60 : 0,
    );

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.core.seekTo).toHaveBeenCalledWith(12);
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing',
      body: { PositionTicks: 120_000_000 },
    });
  });

  it('reports the exact Jellyfin start ticks even when mpv has already advanced slightly', async () => {
    const { runtime, transport, api } = createRuntime();
    const resumePlan = { ...plan, startPositionTicks: 120_000_000 };
    const resumeLaunch = { ...launch, plan: resumePlan };
    const internals = runtime as unknown as {
      launch: PlayerLaunch;
      session: PlaybackSessionState;
    };
    internals.launch = resumeLaunch;
    internals.session = {
      generation: 1,
      status: 'preparing',
      plan: resumePlan,
      positionTicks: resumePlan.startPositionTicks,
      durationTicks: resumePlan.runtimeTicks,
    };
    api.mpv.getNumber.mockImplementation((name: string) =>
      name === 'time-pos' ? 12.5 : name === 'duration' ? 60 : 0,
    );

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.core.seekTo).not.toHaveBeenCalled();
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      body: { PositionTicks: 120_000_000 },
    });
  });

  it('does not seek twice when a direct stream already starts at the Jellyfin offset', async () => {
    const { runtime, transport, api } = createRuntime();
    const offsetPlan: PlaybackPlan = {
      ...plan,
      playMethod: 'DirectStream',
      conversion: 'container',
      startPositionTicks: 120_000_000,
      url: 'https://media.test/Videos/item/stream?StartTimeTicks=120000000',
    };
    const offsetLaunch: PlayerLaunch = { ...launch, plan: offsetPlan };
    const internals = runtime as unknown as {
      launch: PlayerLaunch;
      session: PlaybackSessionState;
      positionBaseTicks: number;
    };
    internals.launch = offsetLaunch;
    internals.session = {
      generation: 1,
      status: 'preparing',
      plan: offsetPlan,
      positionTicks: offsetPlan.startPositionTicks,
      durationTicks: offsetPlan.runtimeTicks,
    };
    internals.positionBaseTicks = offsetPlan.startPositionTicks;
    api.mpv.getNumber.mockImplementation((name: string) =>
      name === 'time-pos' ? 0 : name === 'duration' ? 60 : 0,
    );

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.core.seekTo).not.toHaveBeenCalled();
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      body: { PositionTicks: 120_000_000 },
    });
  });

  it('forces Play from Beginning back to zero when mpv exposes a stale watch-later position', async () => {
    const { runtime, transport, api, logger } = createRuntime();
    seedSession(runtime, 'preparing');
    api.mpv.getNumber.mockImplementation((name: string) =>
      name === 'time-pos' ? 1_800 : name === 'duration' ? 60 : 0,
    );

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.core.seekTo).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith('player.position.corrected', {
      correlation: undefined,
      resumed: false,
    });
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing',
      body: { PositionTicks: 0 },
    });
  });

  it('ignores file-loaded from a playback sequence that has already been replaced', async () => {
    const { runtime, transport, api, loadTrack } = createRuntime();
    seedSession(runtime, 'preparing', '@tmp/stale-subtitle.srt');
    const internals = runtime as unknown as {
      activeLoadReplacementSequence: number;
      replacementSequence: number;
      mediaLoaded(): Promise<void>;
    };
    internals.activeLoadReplacementSequence = 1;
    internals.replacementSequence = 2;

    await internals.mediaLoaded();

    expect(transport.execute).not.toHaveBeenCalled();
    expect(api.core.seekTo).not.toHaveBeenCalled();
    expect(loadTrack).not.toHaveBeenCalled();
  });

  it('reports a failed stop when media ends before file-loaded and removes temporary subtitles', async () => {
    const { runtime, transport, deleteFile } = createRuntime();
    seedSession(runtime, 'preparing', '@tmp/jellyfin-subtitle-1.srt');

    await (runtime as unknown as { ended(): Promise<void> }).ended();

    expect(transport.execute).toHaveBeenCalledTimes(1);
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing/Stopped',
      body: { ItemId: 'item-1', Failed: true },
    });
    expect(deleteFile).toHaveBeenCalledWith('@tmp/jellyfin-subtitle-1.srt');
  });

  it('preserves the last known position when time-pos is unavailable at natural EOF', async () => {
    const { runtime, transport, api } = createRuntime();
    seedSession(runtime, 'playing');
    const internals = runtime as unknown as { session: PlaybackSessionState };
    internals.session.positionTicks = 590_000_000;
    api.mpv.getNumber.mockImplementation((name: string) =>
      name === 'time-pos' ? Number.NaN : name === 'duration' ? 60 : 0,
    );

    await (runtime as unknown as { ended(): Promise<void> }).ended();

    expect(internals.session.stopReason).toBe('completed');
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing/Stopped',
      body: { PositionTicks: 590_000_000 },
    });
  });

  it('cannot scrub a newer playback when an older end report settles later', async () => {
    const { runtime, transport, deleteFile } = createRuntime();
    seedSession(runtime, 'playing', '@tmp/old-subtitle.srt');
    let finishReport: (() => void) | undefined;
    transport.execute.mockImplementationOnce(
      () => new Promise<unknown>((resolve) => (finishReport = () => resolve({}))),
    );
    const nextPlan = {
      ...plan,
      itemId: 'item-2',
      playSessionId: 'play-session-2',
    };
    const nextLaunch: PlayerLaunch = { ...launch, nonce: 'play-2', plan: nextPlan };
    const internals = runtime as unknown as {
      launch?: PlayerLaunch;
      session: PlaybackSessionState;
      externalSubtitlePath?: string;
      ended(): Promise<void>;
    };

    const ending = internals.ended();
    expect(internals.launch).toBeUndefined();
    internals.launch = nextLaunch;
    internals.session = {
      generation: 2,
      status: 'playing',
      plan: nextPlan,
      positionTicks: 0,
      durationTicks: nextPlan.runtimeTicks,
    };
    internals.externalSubtitlePath = '@tmp/new-subtitle.srt';
    await vi.waitFor(() => expect(transport.execute).toHaveBeenCalledOnce());
    finishReport?.();
    await ending;

    expect(internals.launch).toBe(nextLaunch);
    expect(internals.session.status).toBe('playing');
    expect(internals.externalSubtitlePath).toBe('@tmp/new-subtitle.srt');
    expect(deleteFile).toHaveBeenCalledWith('@tmp/old-subtitle.srt');
    expect(deleteFile).not.toHaveBeenCalledWith('@tmp/new-subtitle.srt');
  });

  it('ignores the replaced media end-file even after the next generation is preparing', async () => {
    const { runtime, transport, api } = createRuntime();
    seedSession(runtime, 'playing');
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(nextLaunch: PlayerLaunch, sequence: number): Promise<void>;
      handleEndFile(): void;
      launch: PlayerLaunch;
      session: PlaybackSessionState;
    };
    internals.replacementSequence = 1;

    const nextPlan = { ...plan, itemId: 'item-2', playSessionId: 'play-session-2' };
    const nextLaunch = { ...launch, nonce: 'next-load', plan: nextPlan };
    await internals.replace(nextLaunch, 1);
    internals.launch = nextLaunch;
    internals.session = {
      generation: 2,
      status: 'preparing',
      plan: nextPlan,
      positionTicks: 0,
      durationTicks: nextPlan.runtimeTicks,
    };
    internals.handleEndFile();
    await Promise.resolve();

    expect(api.core.open).not.toHaveBeenCalled();
    expect(api.mpv.command).toHaveBeenCalledWith('loadfile', ['null://', 'replace']);
    expect(internals.session.status).toBe('preparing');
    expect(transport.execute).toHaveBeenCalledTimes(1);
  });

  it('reopens an idle managed core through IINA instead of issuing a hidden mpv load', async () => {
    const { runtime, api } = createRuntime();
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(nextLaunch: PlayerLaunch, sequence: number): Promise<void>;
    };
    internals.replacementSequence = 1;
    api.core.status.idle = true;

    await internals.replace(launch, 1);

    expect(api.core.open).toHaveBeenCalledWith('null://');
    expect(api.mpv.command).not.toHaveBeenCalled();
  });

  it('replaces an active managed core through mpv without closing its window', async () => {
    const { runtime, api } = createRuntime();
    seedSession(runtime, 'playing');
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(nextLaunch: PlayerLaunch, sequence: number): Promise<void>;
    };
    internals.replacementSequence = 1;
    api.core.status.idle = false;
    const nextLaunch = {
      ...launch,
      nonce: 'play-2',
      plan: { ...plan, itemId: 'item-2', playSessionId: 'play-session-2' },
    };

    await internals.replace(nextLaunch, 1);

    expect(api.mpv.command).toHaveBeenCalledWith('loadfile', ['null://', 'replace']);
    expect(api.core.open).not.toHaveBeenCalled();
  });

  it('uses mpv for a superseding launch while the managed core is still non-idle', async () => {
    const { runtime, api } = createRuntime();
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(nextLaunch: PlayerLaunch, sequence: number): Promise<void>;
    };
    internals.replacementSequence = 2;
    api.core.status.idle = false;

    await internals.replace({ ...launch, nonce: 'latest-play' }, 2);

    expect(api.mpv.command).toHaveBeenCalledWith('loadfile', ['null://', 'replace']);
    expect(api.core.open).not.toHaveBeenCalled();
  });

  it('queues the replaced-session stop report ahead of the reused-player start report', async () => {
    const { runtime, api, transport } = createRuntime();
    seedSession(runtime, 'playing');
    api.core.status.idle = false;
    api.mpv.getString.mockReturnValue('null://');
    const nextPlan = {
      ...plan,
      itemId: 'item-2',
      playSessionId: 'play-session-2',
      url: 'https://media.test/Videos/item-2/stream',
    };
    const nextLaunch = { ...launch, nonce: 'play-2', plan: nextPlan };
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(next: PlayerLaunch, sequence: number): Promise<void>;
      resolveLoad(next?: () => void): Promise<void>;
      mediaLoaded(): Promise<void>;
      reportQueue: Promise<void>;
    };
    internals.replacementSequence = 1;

    await internals.replace(nextLaunch, 1);
    await internals.resolveLoad();
    await internals.mediaLoaded();
    await internals.reportQueue;

    expect(transport.execute.mock.calls.map(([request]) => request.url)).toEqual([
      'https://media.test/Sessions/Playing/Stopped',
      'https://media.test/Sessions/Playing',
    ]);
  });

  it('deletes a stale subtitle download and never exposes it to a later load', async () => {
    const { runtime, transport, api, deleteFile } = createRuntime();
    const subtitlePlan: PlaybackPlan = {
      ...plan,
      externalSubtitle: {
        index: 3,
        deliveryUrl: 'https://media.test/subtitles/3.srt',
        codec: 'srt',
      },
    };
    const subtitleLaunch: PlayerLaunch = { ...launch, nonce: 'subtitle-load', plan: subtitlePlan };
    let finishDownload: (() => void) | undefined;
    transport.download.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishDownload = resolve)),
    );
    api.mpv.getString.mockReturnValue('null://');
    const internals = runtime as unknown as {
      resolveLoad(next?: () => void): Promise<void>;
      receiveLaunch(value: unknown): void;
      invalidatePendingLoads(): void;
      externalSubtitlePath?: string;
    };
    internals.externalSubtitlePath = '@tmp/previous-subtitle.srt';
    const next = vi.fn();

    internals.receiveLaunch(subtitleLaunch);
    await vi.waitFor(() => expect(api.core.open).toHaveBeenCalledWith('null://'));
    const pending = internals.resolveLoad(next);
    await vi.waitFor(() => expect(transport.download).toHaveBeenCalledOnce());
    internals.invalidatePendingLoads();
    finishDownload?.();
    await pending;

    expect(deleteFile).toHaveBeenCalledWith('@tmp/previous-subtitle.srt');
    expect(deleteFile).toHaveBeenCalledWith('@tmp/jellyfin-subtitle-subtitle-load-1-2.srt');
    expect(internals.externalSubtitlePath).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('uses launch-unique paths for temporary external subtitles', async () => {
    const first = createRuntime();
    const second = createRuntime();
    const subtitlePlan: PlaybackPlan = {
      ...plan,
      externalSubtitle: {
        index: 3,
        deliveryUrl: 'https://media.test/subtitles/3.srt',
        codec: 'srt',
      },
    };
    const firstLaunch: PlayerLaunch = { ...launch, nonce: 'player/one', plan: subtitlePlan };
    const secondLaunch: PlayerLaunch = { ...launch, nonce: 'player:two', plan: subtitlePlan };
    type SubtitleInternals = {
      launch: PlayerLaunch;
      session: PlaybackSessionState;
      downloadExternalSubtitle(
        currentLaunch: PlayerLaunch,
        loadSequence: number,
        generation: number,
      ): Promise<void>;
    };
    const firstInternals = first.runtime as unknown as SubtitleInternals;
    const secondInternals = second.runtime as unknown as SubtitleInternals;
    firstInternals.launch = firstLaunch;
    firstInternals.session = {
      generation: 1,
      status: 'preparing',
      plan: subtitlePlan,
      positionTicks: 0,
    };
    secondInternals.launch = secondLaunch;
    secondInternals.session = {
      generation: 1,
      status: 'preparing',
      plan: subtitlePlan,
      positionTicks: 0,
    };

    await Promise.all([
      firstInternals.downloadExternalSubtitle(firstLaunch, 0, 1),
      secondInternals.downloadExternalSubtitle(secondLaunch, 0, 1),
    ]);

    expect(first.transport.download.mock.calls[0]?.[1]).toBe(
      '@tmp/jellyfin-subtitle-player-one-1-0.srt',
    );
    expect(second.transport.download.mock.calls[0]?.[1]).toBe(
      '@tmp/jellyfin-subtitle-player-two-1-0.srt',
    );
  });

  it('removes a partial temporary subtitle when its download fails', async () => {
    const { runtime, transport, deleteFile } = createRuntime();
    const subtitlePlan: PlaybackPlan = {
      ...plan,
      externalSubtitle: {
        index: 3,
        deliveryUrl: 'https://media.test/subtitles/3.srt',
        codec: 'srt',
      },
    };
    const subtitleLaunch: PlayerLaunch = {
      ...launch,
      nonce: 'failed/subtitle',
      plan: subtitlePlan,
    };
    const downloadError = new Error('download interrupted');
    transport.download.mockRejectedValueOnce(downloadError);
    const internals = runtime as unknown as {
      launch: PlayerLaunch;
      session: PlaybackSessionState;
      downloadExternalSubtitle(
        currentLaunch: PlayerLaunch,
        loadSequence: number,
        generation: number,
      ): Promise<void>;
    };
    internals.launch = subtitleLaunch;
    internals.session = {
      generation: 1,
      status: 'preparing',
      plan: subtitlePlan,
      positionTicks: 0,
    };

    await expect(internals.downloadExternalSubtitle(subtitleLaunch, 0, 1)).rejects.toBe(
      downloadError,
    );

    expect(deleteFile).toHaveBeenCalledWith('@tmp/jellyfin-subtitle-failed-subtitle-1-0.srt');
  });

  it('serializes playback reports so progress cannot overtake start', async () => {
    const { runtime, transport } = createRuntime();
    seedSession(runtime, 'playing');
    let releaseStart: (() => void) | undefined;
    transport.execute.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseStart = resolve)),
    );

    const first = (
      runtime as unknown as {
        sendReport(kind: 'start' | 'progress' | 'stopped'): Promise<void>;
      }
    ).sendReport('start');
    const second = (
      runtime as unknown as {
        sendReport(kind: 'start' | 'progress' | 'stopped'): Promise<void>;
      }
    ).sendReport('progress');
    await Promise.resolve();
    expect(transport.execute).toHaveBeenCalledTimes(1);

    releaseStart?.();
    await first;
    await second;
    expect(transport.execute.mock.calls.map(([request]) => request.url)).toEqual([
      'https://media.test/Sessions/Playing',
      'https://media.test/Sessions/Playing/Progress',
    ]);
  });

  it('suppresses a queued null load after a newer launch invalidates it', async () => {
    const { runtime, api, logger } = createRuntime();
    api.mpv.getString.mockReturnValue('null://');
    const next = vi.fn();
    const internals = runtime as unknown as {
      pendingLaunchesForHook: Array<{
        launch: PlayerLaunch;
        replacementSequence: number;
      }>;
      replacementSequence: number;
      resolveLoad(next?: () => void): Promise<void>;
    };
    internals.pendingLaunchesForHook.push({ launch, replacementSequence: 1 });
    internals.replacementSequence = 2;

    await internals.resolveLoad(next);

    expect(next).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
    expect(api.mpv.set).not.toHaveBeenCalledWith('stream-open-filename', plan.url);
  });

  it('discards stale null handoffs until it finds the current launch', async () => {
    const { runtime, api } = createRuntime();
    api.mpv.getString.mockReturnValue('null://');
    const next = vi.fn();
    const currentPlan = {
      ...plan,
      itemId: 'item-current',
      playSessionId: 'play-session-current',
      url: 'https://media.test/Videos/item-current/stream',
    };
    const currentLaunch = {
      ...launch,
      nonce: 'play-current',
      plan: currentPlan,
      display: {
        title: "Welcome to Widow's Bay!",
        seriesName: "Widow's Bay",
        seasonNumber: 1,
        episodeNumber: 1,
      },
    };
    const internals = runtime as unknown as {
      pendingLaunchesForHook: Array<{
        launch: PlayerLaunch;
        replacementSequence: number;
      }>;
      replacementSequence: number;
      resolveLoad(next?: () => void): Promise<void>;
    };
    internals.pendingLaunchesForHook.push(
      { launch, replacementSequence: 1 },
      { launch: currentLaunch, replacementSequence: 2 },
    );
    internals.replacementSequence = 2;

    await internals.resolveLoad(next);

    expect(api.mpv.set).toHaveBeenCalledWith(
      'file-local-options/force-media-title',
      "Widow's Bay — S01E01 — Welcome to Widow's Bay!",
    );
    expect(api.mpv.set).toHaveBeenCalledWith('stream-open-filename', currentPlan.url);
    expect(internals.pendingLaunchesForHook).toHaveLength(0);
    expect(next).toHaveBeenCalledOnce();
  });

  it('cancels queued Jellyfin work when an external URL starts loading', async () => {
    const { runtime, api } = createRuntime();
    api.mpv.getString.mockReturnValue('https://unrelated.example/video.mp4');
    const next = vi.fn();
    const internals = runtime as unknown as {
      receiveLaunch(value: unknown): void;
      resolveLoad(next?: () => void): Promise<void>;
      controlQueue: Promise<void>;
    };

    internals.receiveLaunch(launch);
    await internals.resolveLoad(next);
    await internals.controlQueue;

    expect(api.core.open).not.toHaveBeenCalledWith('null://');
    expect(next).toHaveBeenCalledOnce();
  });

  it('clears pending null handoffs as soon as stop and close are requested', () => {
    vi.useFakeTimers();
    try {
      const { runtime, api } = createRuntime();
      const internals = runtime as unknown as {
        pendingLaunchesForHook: Array<{
          launch: PlayerLaunch;
          replacementSequence: number;
        }>;
        progressTimer: ReturnType<typeof setInterval>;
      };
      runtime.install();
      const stopHandler = api.global.onMessage.mock.calls.find(
        ([name]) => name === 'jellyfin.player.stop',
      )?.[1] as ((value: unknown) => void) | undefined;
      const closeHandler = api.event.on.mock.calls.find(
        ([name]) => name === 'iina.window-will-close',
      )?.[1] as (() => void) | undefined;

      internals.pendingLaunchesForHook.push({ launch, replacementSequence: 1 });
      stopHandler?.({ reason: 'user' });
      expect(internals.pendingLaunchesForHook).toHaveLength(0);

      internals.pendingLaunchesForHook.push({ launch, replacementSequence: 2 });
      closeHandler?.();
      expect(internals.pendingLaunchesForHook).toHaveLength(0);
      clearInterval(internals.progressTimer);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts periodic reporting when a retained player receives a launch after close', async () => {
    vi.useFakeTimers();
    try {
      const { runtime, api } = createRuntime();
      const internals = runtime as unknown as {
        receiveLaunch(value: unknown): void;
        controlQueue: Promise<void>;
        progressTimer?: ReturnType<typeof setInterval>;
      };
      runtime.install();
      const firstTimer = internals.progressTimer;
      const closeHandler = api.event.on.mock.calls.find(
        ([name]) => name === 'iina.window-will-close',
      )?.[1] as (() => void) | undefined;

      closeHandler?.();
      expect(internals.progressTimer).toBeUndefined();

      internals.receiveLaunch(launch);
      expect(internals.progressTimer).toBeDefined();
      expect(internals.progressTimer).not.toBe(firstTimer);
      await internals.controlQueue;
      if (internals.progressTimer !== undefined) clearInterval(internals.progressTimer);
    } finally {
      vi.useRealTimers();
    }
  });

  it('requests the global catalog through shared non-secret preferences', () => {
    const { runtime, api } = createRuntime();

    (
      runtime as unknown as {
        handleViewAction(raw: unknown, source: 'sidebar' | 'overlay'): void;
      }
    ).handleViewAction({ action: 'window.openCatalog' }, 'sidebar');

    expect(api.preferences.set).toHaveBeenCalledWith('catalogOpenRequestAtMs', expect.any(Number));
    expect(api.preferences.sync).toHaveBeenCalledOnce();
    expect(api.global.postMessage).not.toHaveBeenCalledWith(
      'jellyfin.catalog.open',
      expect.anything(),
    );
  });
});
