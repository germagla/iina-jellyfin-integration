import { describe, expect, it } from 'vitest';

import {
  ArtworkRequestSchema,
  BridgeRequestSchema,
  CatalogRequestSchema,
  PlaybackRequestSchema,
  parseBridgeRequest,
} from '../src/contracts';
import { parseBridgeResult } from '../src/bridge-results';

describe('bridge contracts', () => {
  it('parses an allowlisted catalog operation and supplies pagination defaults', () => {
    const request = parseBridgeRequest({
      operation: 'catalog.query',
      requestId: 'request-1',
      payload: { kind: 'library', itemType: 'Movie', parentId: 'library-1' },
    });

    expect(request.operation).toBe('catalog.query');
    if (request.operation === 'catalog.query' && request.payload.kind === 'library') {
      expect(request.payload).toMatchObject({ startIndex: 0, limit: 50, sortBy: 'SortName' });
    }
  });

  it('requires every library query to be scoped to a Jellyfin view', () => {
    expect(() => CatalogRequestSchema.parse({ kind: 'library', itemType: 'Movie' })).toThrow();
  });

  it('bounds the larger Recently Added scan', () => {
    expect(() =>
      CatalogRequestSchema.parse({ kind: 'home', shelf: 'recentlyAdded', limit: 200 }),
    ).not.toThrow();
    expect(() =>
      CatalogRequestSchema.parse({ kind: 'home', shelf: 'recentlyAdded', limit: 201 }),
    ).toThrow();
  });

  it('rejects unknown operations and unknown payload properties', () => {
    expect(() =>
      BridgeRequestSchema.parse({ operation: 'iina.evaluate', requestId: 'bad', payload: {} }),
    ).toThrow();
    expect(() =>
      BridgeRequestSchema.parse({
        operation: 'catalog.refresh',
        requestId: 'bad',
        payload: { arbitraryIinaAccess: true },
      }),
    ).toThrow();
  });

  it('does not allow the Quick Connect secret to round-trip through the webview', () => {
    expect(() =>
      BridgeRequestSchema.parse({
        operation: 'connection.quickConnect.poll',
        requestId: 'quick-1',
        payload: { secret: 'must-remain-in-global-memory' },
      }),
    ).toThrow();
    expect(
      BridgeRequestSchema.parse({
        operation: 'connection.quickConnect.poll',
        requestId: 'quick-2',
        payload: {},
      }),
    ).toMatchObject({ operation: 'connection.quickConnect.poll' });
  });

  it('bounds artwork broker requests', () => {
    expect(() =>
      ArtworkRequestSchema.parse({
        itemId: 'movie-1',
        imageType: 'Primary',
        width: 2048,
        height: 2048,
        quality: 85,
      }),
    ).not.toThrow();
    expect(() =>
      ArtworkRequestSchema.parse({
        itemId: 'movie-1',
        imageType: 'Primary',
        width: 4096,
        height: 4096,
      }),
    ).toThrow();
  });

  it('normalizes catalog and playback defaults at the trust boundary', () => {
    expect(CatalogRequestSchema.parse({ kind: 'search', query: 'Alien' })).toMatchObject({
      includeItemTypes: ['Movie', 'Series'],
      startIndex: 0,
      limit: 50,
    });
    expect(PlaybackRequestSchema.parse({ itemId: 'movie-1' })).toMatchObject({
      startPositionTicks: 0,
      maxStreamingBitrate: 120_000_000,
      openInNewWindow: false,
    });
    expect(() =>
      PlaybackRequestSchema.parse({ itemId: 'movie-1', videoTranscodeApproved: true }),
    ).toThrow();
    expect(
      PlaybackRequestSchema.parse({
        itemId: 'movie-1',
        videoTranscodeConfirmationId: 'confirmation-1',
      }),
    ).toMatchObject({ videoTranscodeConfirmationId: 'confirmation-1' });
  });

  it('requires an opaque permit on video-transcode confirmation results', () => {
    const plan = {
      playMethod: 'Transcode',
      conversion: 'video',
      requiresVideoTranscodeConfirmation: true,
      transcodeReasons: ['VideoCodecNotSupported'],
      mediaSourceId: 'source-1',
    };

    expect(() =>
      parseBridgeResult('playback.start', { status: 'confirmation-required', plan }),
    ).toThrow();
    expect(
      parseBridgeResult('playback.start', {
        status: 'confirmation-required',
        confirmationId: 'confirmation-1',
        plan,
      }),
    ).toMatchObject({ confirmationId: 'confirmation-1' });
  });

  it('requires a public playback identifier when native playback starts', () => {
    const plan = {
      playMethod: 'DirectPlay',
      conversion: 'none',
      requiresVideoTranscodeConfirmation: false,
      transcodeReasons: [],
      mediaSourceId: 'source-1',
    };

    expect(() => parseBridgeResult('playback.start', { status: 'started', plan })).toThrow();
    expect(
      parseBridgeResult('playback.start', {
        status: 'started',
        playbackId: 'playback-1',
        plan,
      }),
    ).toMatchObject({ playbackId: 'playback-1' });
  });

  it('strips hostile Jellyfin fields from catalog results before they cross the webview bridge', () => {
    const backdropTags = Array.from({ length: 12 }, (_, index) => `backdrop-${index + 1}`);
    const result = parseBridgeResult('catalog.query', {
      Id: 'movie-1',
      Name: '<img src=x onerror=alert(1)>',
      BackdropImageTags: backdropTags,
      Path: '/private/media/movie.mkv',
      AccessToken: 'must-not-cross',
      MediaSources: [
        {
          Id: 'source-1',
          Name: '1080p',
          Path: '/private/media/movie.mkv',
          RequiredHttpHeaders: { Authorization: 'secret' },
          MediaStreams: [{ Index: 0, Type: 'Video', Codec: 'h264', DeliveryUrl: '/secret' }],
        },
      ],
    });

    expect(result).toEqual({
      Id: 'movie-1',
      Name: '<img src=x onerror=alert(1)>',
      BackdropImageTags: backdropTags.slice(0, 8),
      MediaSources: [
        {
          Id: 'source-1',
          Name: '1080p',
          MediaStreams: [{ Index: 0, Type: 'Video', Codec: 'h264' }],
        },
      ],
    });
  });

  it('rejects non-image and oversized-looking artwork bridge values', () => {
    expect(() =>
      parseBridgeResult('artwork.fetch', { dataUrl: 'https://attacker.test/a.png' }),
    ).toThrow();
  });
});
