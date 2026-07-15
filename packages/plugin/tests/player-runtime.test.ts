import { describe, expect, it, vi } from 'vitest';
import type { PlaybackPlan, PlaybackSessionState } from '@iina-jellyfin/core';
import {
  PlayerRuntime,
  nonceFromPlaybackUrl,
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
      subtitle: { loadTrack },
    },
    file: {
      exists: vi.fn(() => true),
      delete: deleteFile,
      handle: vi.fn(() => ({
        seekToEnd: vi.fn(),
        offset: vi.fn(() => 100),
        close: vi.fn(),
      })),
    },
    global: { postMessage: vi.fn() },
    mpv: {
      getString: vi.fn(() => ''),
      getNumber: vi.fn((name: string): number => (name === 'duration' ? 60 : 0)),
      getFlag: vi.fn(() => false),
      getNative: vi.fn(() => []),
      set: vi.fn(),
    },
    preferences: { get: vi.fn(), set: vi.fn(), sync: vi.fn() },
    sidebar: { postMessage: vi.fn() },
    overlay: { postMessage: vi.fn(), hide: vi.fn(), show: vi.fn() },
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
  it('accepts only opaque plugin playback URLs', () => {
    expect(nonceFromPlaybackUrl('iina-jellyfin://play/play-123')).toBe('play-123');
    expect(nonceFromPlaybackUrl('https://example.test/play/play-123')).toBeUndefined();
    expect(nonceFromPlaybackUrl('iina-jellyfin://other/play-123')).toBeUndefined();
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

  it('clears Jellyfin HTTP headers before a non-plugin URL loads', async () => {
    const set = vi.fn();
    const runtime = new PlayerRuntime(
      {
        mpv: {
          getString: () => 'https://unrelated.example/video.mp4',
          set,
        },
      } as never,
      {} as never,
      {} as never,
    );

    await (runtime as unknown as { resolveLoad(next?: () => void): Promise<void> }).resolveLoad();

    expect(set).toHaveBeenCalledWith('http-header-fields', []);
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

  it('reports the requested direct-play resume position before the asynchronous seek settles', async () => {
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

    await (runtime as unknown as { mediaLoaded(): Promise<void> }).mediaLoaded();

    expect(api.core.seekTo).toHaveBeenCalledWith(12);
    expect(transport.execute.mock.calls[0]?.[0]).toMatchObject({
      url: 'https://media.test/Sessions/Playing',
      body: { PositionTicks: 120_000_000 },
    });
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

  it('ignores the replaced media end-file even after the next generation is preparing', async () => {
    const { runtime, transport, api } = createRuntime();
    seedSession(runtime, 'playing');
    const internals = runtime as unknown as {
      replacementSequence: number;
      replace(nonce: string, sequence: number): Promise<void>;
      handleEndFile(): void;
      launch: PlayerLaunch;
      session: PlaybackSessionState;
    };
    internals.replacementSequence = 1;

    await internals.replace('next-load', 1);
    const nextPlan = { ...plan, itemId: 'item-2', playSessionId: 'play-session-2' };
    internals.launch = { ...launch, nonce: 'next-load', plan: nextPlan };
    internals.session = {
      generation: 2,
      status: 'preparing',
      plan: nextPlan,
      positionTicks: 0,
      durationTicks: nextPlan.runtimeTicks,
    };
    internals.handleEndFile();
    await Promise.resolve();

    expect(api.core.open).toHaveBeenCalledWith('iina-jellyfin://play/next-load');
    expect(internals.session.status).toBe('preparing');
    expect(transport.execute).toHaveBeenCalledTimes(1);
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
    api.mpv.getString.mockReturnValue('iina-jellyfin://play/subtitle-load');
    const internals = runtime as unknown as {
      resolveLoad(next?: () => void): Promise<void>;
      receiveLaunch(value: unknown): void;
      invalidatePendingLoads(): void;
      externalSubtitlePath?: string;
    };
    internals.externalSubtitlePath = '@tmp/previous-subtitle.srt';
    const next = vi.fn();

    const pending = internals.resolveLoad(next);
    await Promise.resolve();
    internals.receiveLaunch(subtitleLaunch);
    await vi.waitFor(() => expect(transport.download).toHaveBeenCalledOnce());
    internals.invalidatePendingLoads();
    finishDownload?.();
    await pending;

    expect(deleteFile).toHaveBeenCalledWith('@tmp/previous-subtitle.srt');
    expect(deleteFile).toHaveBeenCalledWith('@tmp/jellyfin-subtitle-1-1.srt');
    expect(internals.externalSubtitlePath).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
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

  it('suppresses a delayed playback plan after a newer load invalidates it', async () => {
    const { runtime, api, logger } = createRuntime();
    api.mpv.getString.mockReturnValue('iina-jellyfin://play/stale-plan');
    const next = vi.fn();

    const pending = (
      runtime as unknown as {
        resolveLoad(next?: () => void): Promise<void>;
      }
    ).resolveLoad(next);
    await Promise.resolve();
    (runtime as unknown as { invalidatePendingLoads(): void }).invalidatePendingLoads();
    await pending;

    expect(next).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
    expect(api.mpv.set).not.toHaveBeenCalledWith('stream-open-filename', 'null://');
  });
});
