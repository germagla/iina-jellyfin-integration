import { describe, expect, it } from 'vitest';

import type { AuthenticatedApiContext } from '../src/api';
import { PlaybackRequestSchema } from '../src/contracts';
import {
  buildPlaybackReportPayload,
  buildPlaybackReportRequest,
  selectPlaybackPlan,
} from '../src/playback';
import {
  beginPlaybackSession,
  createIdlePlaybackSession,
  reducePlaybackSession,
} from '../src/session';
import playback1010 from './fixtures/jellyfin-10.10-playback-info.json';
import report1010 from './fixtures/jellyfin-10.10-playback-report.json';
import playback1011 from './fixtures/jellyfin-10.11-playback-info.json';
import report1011 from './fixtures/jellyfin-10.11-playback-report.json';

const context: AuthenticatedApiContext = {
  serverUrl: 'https://media.example/jellyfin',
  accessToken: 'header-secret',
  userId: 'user-1',
  deviceId: 'stable-device',
  version: '0.1.0',
};

function request(overrides: Record<string, unknown> = {}) {
  return PlaybackRequestSchema.parse({ itemId: 'movie-1', ...overrides });
}

describe('playback plan selection', () => {
  it('constructs the authenticated static endpoint for a direct-play filesystem source', () => {
    const plan = selectPlaybackPlan(playback1010, request(), context);
    const url = new URL(plan.url);

    expect(plan.playMethod).toBe('DirectPlay');
    expect(plan.conversion).toBe('none');
    expect(plan.requiresVideoTranscodeConfirmation).toBe(false);
    expect(url.pathname).toBe('/jellyfin/Videos/movie-1/stream');
    expect(url.searchParams.get('Static')).toBe('true');
    expect(url.searchParams.get('MediaSourceId')).toBe('ms-direct-local-path');
    expect(url.searchParams.get('PlaySessionId')).toBe('play-session-1010');
    expect(plan.headers).toMatchObject({ 'User-Agent': 'IINA' });
    expect(plan.headers.Authorization).toContain('Token="header-secret"');
  });

  it('preserves selected tracks and enough authenticated external-subtitle metadata', () => {
    const plan = selectPlaybackPlan(
      playback1010,
      request({ audioStreamIndex: 1, subtitleStreamIndex: 3 }),
      context,
    );
    expect(plan.audioStreamIndex).toBe(1);
    expect(plan.subtitleStreamIndex).toBe(3);
    expect(plan.externalSubtitle).toMatchObject({
      index: 3,
      codec: 'srt',
      language: 'eng',
      displayTitle: 'English - SRT',
    });
    expect(plan.externalSubtitle?.deliveryUrl).toBe(
      'https://media.example/jellyfin/Videos/movie-1/ms-direct-local-path/Subtitles/3/0/Stream.srt?api_key=fixture-subtitle-key',
    );
  });

  it('uses a server-generated direct-stream URL unchanged', () => {
    const plan = selectPlaybackPlan(
      playback1011,
      request({ itemId: 'movie-2', mediaSourceId: 'ms-remux-1011' }),
      context,
    );
    expect(plan.playMethod).toBe('DirectStream');
    expect(plan.conversion).toBe('container');
    expect(plan.requiresVideoTranscodeConfirmation).toBe(false);
    expect(plan.url).toBe(
      'https://media.example/jellyfin/Videos/movie-2/stream?Static=false&MediaSourceId=ms-remux-1011&VideoCodec=copy&AudioCodec=copy&TranscodeReasons=ContainerNotSupported&api_key=fixture-remux-key',
    );
  });

  it('allows audio-only conversion automatically', () => {
    const plan = selectPlaybackPlan(
      playback1011,
      request({ itemId: 'movie-2', mediaSourceId: 'ms-audio-convert-1011' }),
      context,
    );
    expect(plan.playMethod).toBe('Transcode');
    expect(plan.conversion).toBe('audio');
    expect(plan.requiresVideoTranscodeConfirmation).toBe(false);
    expect(plan.url).toContain('VideoCodec=copy');
    expect(plan.url).toContain('api_key=fixture-audio-key');
  });

  it('reports audio-only conversion as Direct Stream when Jellyfin marks it eligible', () => {
    const response = structuredClone(playback1011);
    const source = response.MediaSources.find(
      (candidate) => candidate.Id === 'ms-audio-convert-1011',
    );
    if (source === undefined) throw new Error('Audio conversion fixture is missing');
    source.SupportsDirectStream = true;

    const plan = selectPlaybackPlan(
      response,
      request({ itemId: 'movie-2', mediaSourceId: source.Id }),
      context,
    );
    expect(plan.playMethod).toBe('DirectStream');
    expect(plan.conversion).toBe('audio');
  });

  it('marks video re-encoding as requiring confirmation even before approval', () => {
    const plan = selectPlaybackPlan(
      playback1011,
      request({
        itemId: 'movie-2',
        mediaSourceId: 'ms-video-transcode-1011',
        videoTranscodeApproved: false,
      }),
      context,
    );
    expect(plan.playMethod).toBe('Transcode');
    expect(plan.conversion).toBe('video');
    expect(plan.requiresVideoTranscodeConfirmation).toBe(true);
    expect(plan.transcodeReasons).toContain('VideoCodecNotSupported');
  });
});

describe('playback report contracts', () => {
  it('builds accurate start, progress, and stopped payloads', () => {
    const plan = selectPlaybackPlan(playback1010, request(), context);
    let state = beginPlaybackSession(createIdlePlaybackSession(), plan);
    state = reducePlaybackSession(state, {
      type: 'media-started',
      generation: state.generation,
      positionTicks: 50_000_000,
      durationTicks: 72_000_000_000,
    });

    const startPayload = buildPlaybackReportPayload('start', state, { volumeLevel: 72 });
    expect(startPayload).toEqual(report1010);
    expect(startPayload).toEqual(report1011);

    state = reducePlaybackSession(state, {
      type: 'pause',
      generation: state.generation,
      positionTicks: 60_000_000,
    });
    expect(
      buildPlaybackReportPayload('progress', state, { eventName: 'pause', isMuted: true }),
    ).toMatchObject({
      IsPaused: true,
      IsMuted: true,
      IsPlaying: false,
      EventName: 'pause',
      PlayMethod: 'DirectPlay',
    });

    state = reducePlaybackSession(state, {
      type: 'stop',
      generation: state.generation,
      positionTicks: 65_000_000,
      reason: 'closed',
    });
    const stopped = buildPlaybackReportRequest('stopped', state, context);
    expect(stopped.url).toBe('https://media.example/jellyfin/Sessions/Playing/Stopped');
    expect(stopped.body).toMatchObject({ IsPlaying: false, IsPaused: false, Failed: false });
  });

  it('refuses to report before media begins', () => {
    const plan = selectPlaybackPlan(playback1010, request(), context);
    const preparing = beginPlaybackSession(createIdlePlaybackSession(), plan);
    expect(() => buildPlaybackReportPayload('start', preparing)).toThrow();
  });
});
