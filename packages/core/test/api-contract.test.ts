import { describe, expect, it } from 'vitest';

import {
  buildArtworkHttpRequest,
  buildCatalogRequest,
  buildPasswordAuthenticationRequest,
  buildPlaybackInfoRequest,
  buildPublicServerInfoRequest,
  buildQuickConnectStatusRequest,
  type AuthenticatedApiContext,
} from '../src/api';
import {
  ArtworkRequestSchema,
  CatalogRequestSchema,
  PlaybackRequestSchema,
} from '../src/contracts';
import {
  AuthenticationResultSchema,
  ItemsResultSchema,
  PlaybackInfoResponseSchema,
} from '../src/jellyfin-schemas';
import auth1010 from './fixtures/jellyfin-10.10-auth.json';
import catalog1010 from './fixtures/jellyfin-10.10-catalog.json';
import playback1010 from './fixtures/jellyfin-10.10-playback-info.json';
import auth1011 from './fixtures/jellyfin-10.11-auth.json';
import catalog1011 from './fixtures/jellyfin-10.11-catalog.json';
import playback1011 from './fixtures/jellyfin-10.11-playback-info.json';

const context: AuthenticatedApiContext = {
  serverUrl: 'https://media.example/jellyfin',
  accessToken: 'secret-token',
  userId: 'user/with slash',
  deviceId: 'stable-device',
  version: '0.1.0',
};

describe('recorded Jellyfin 10.10/10.11 contracts', () => {
  it('accepts the authentication and catalog shapes from Jellyfin 10.10 and 10.11', () => {
    expect(AuthenticationResultSchema.parse(auth1010)).toMatchObject({
      AccessToken: 'fixture-access-token-1010',
      ServerId: 'server-1010',
      User: { Id: 'user-1010', Name: 'viewer' },
    });
    expect(ItemsResultSchema.parse(catalog1010)).toMatchObject({
      TotalRecordCount: 1,
      StartIndex: 0,
    });
    expect(AuthenticationResultSchema.parse(auth1011)).toMatchObject({
      AccessToken: 'fixture-access-token-1011',
      ServerId: 'server-1011',
      User: { Id: 'user-1011', Name: 'viewer' },
    });
    expect(ItemsResultSchema.parse(catalog1011)).toMatchObject({
      TotalRecordCount: 2,
      StartIndex: 0,
    });
  });

  it('accepts PlaybackInfo variants from Jellyfin 10.10 and 10.11', () => {
    expect(PlaybackInfoResponseSchema.parse(playback1010).PlaySessionId).toBe('play-session-1010');
    expect(PlaybackInfoResponseSchema.parse(playback1011).MediaSources).toHaveLength(3);
  });
});

describe('authentication and catalog request builders', () => {
  it('probes public information without authentication and keeps the proxy path', () => {
    expect(buildPublicServerInfoRequest('https://media.example/jellyfin/')).toEqual({
      method: 'GET',
      url: 'https://media.example/jellyfin/System/Info/Public',
      headers: { Accept: 'application/json' },
    });
  });

  it('uses the current header and the Jellyfin password payload', () => {
    const request = buildPasswordAuthenticationRequest(
      'https://media.example/jellyfin',
      { deviceId: 'stable-device', version: '0.1.0' },
      { username: 'viewer', password: 'password' },
    );
    expect(request.url).toBe('https://media.example/jellyfin/Users/AuthenticateByName');
    expect(request.headers.Authorization).toContain('DeviceId="stable-device"');
    expect(request.headers.Authorization).not.toContain('password');
    expect(request.body).toEqual({ Username: 'viewer', Pw: 'password' });
  });

  it('keeps Quick Connect secrets in request builders rather than bridge contracts', () => {
    const request = buildQuickConnectStatusRequest(
      'https://media.example/jellyfin',
      { deviceId: 'stable-device', version: '0.1.0' },
      'plugin-memory-secret',
    );
    expect(new URL(request.url).searchParams.get('Secret')).toBe('plugin-memory-secret');
  });

  it('builds paginated library, search, detail, and home shelf queries', () => {
    const library = buildCatalogRequest(
      CatalogRequestSchema.parse({
        kind: 'library',
        itemType: 'Movie',
        parentId: 'library-1',
        startIndex: 100,
        limit: 50,
        sortBy: 'DateCreated',
        sortOrder: 'Descending',
      }),
      context,
    );
    const libraryUrl = new URL(library.url);
    expect(libraryUrl.pathname).toBe('/jellyfin/Users/user%2Fwith%20slash/Items');
    expect(libraryUrl.searchParams.get('ParentId')).toBe('library-1');
    expect(libraryUrl.searchParams.get('StartIndex')).toBe('100');
    expect(libraryUrl.searchParams.get('EnableTotalRecordCount')).toBe('true');
    expect(library.headers.Authorization).toContain('Token="secret-token"');

    const nextUp = buildCatalogRequest(
      CatalogRequestSchema.parse({
        kind: 'home',
        shelf: 'nextUp',
        limit: 12,
        seriesId: 'series-1',
      }),
      context,
    );
    expect(new URL(nextUp.url).pathname).toBe('/jellyfin/Shows/NextUp');
    expect(new URL(nextUp.url).searchParams.get('UserId')).toBe(context.userId);
    expect(new URL(nextUp.url).searchParams.get('SeriesId')).toBe('series-1');

    const details = buildCatalogRequest(
      CatalogRequestSchema.parse({ kind: 'details', itemId: 'item/1' }),
      context,
    );
    expect(new URL(details.url).pathname).toContain('/Items/item%2F1');
  });

  it('builds bounded authenticated artwork and PlaybackInfo requests', () => {
    const artwork = buildArtworkHttpRequest(
      ArtworkRequestSchema.parse({
        itemId: 'movie-1',
        imageType: 'Primary',
        imageTag: 'tag-1',
        width: 640,
        height: 960,
      }),
      context,
    );
    expect(new URL(artwork.url).pathname).toBe('/jellyfin/Items/movie-1/Images/Primary');
    expect(new URL(artwork.url).searchParams.get('maxWidth')).toBe('640');
    expect(artwork.headers.Authorization).toContain('Token="secret-token"');

    const playback = buildPlaybackInfoRequest(
      PlaybackRequestSchema.parse({
        itemId: 'movie-1',
        startPositionTicks: 123,
        mediaSourceId: 'source-1',
        audioStreamIndex: 2,
        subtitleStreamIndex: -1,
      }),
      context,
    );
    expect(new URL(playback.url).pathname).toBe('/jellyfin/Items/movie-1/PlaybackInfo');
    expect(playback.body).toMatchObject({
      UserId: context.userId,
      StartTimeTicks: 123,
      MediaSourceId: 'source-1',
      AudioStreamIndex: 2,
      SubtitleStreamIndex: -1,
      EnableDirectPlay: true,
      EnableDirectStream: true,
      EnableTranscoding: true,
    });
  });
});
