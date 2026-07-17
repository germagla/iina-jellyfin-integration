import type { ArtworkRequest, CatalogRequest, PlaybackRequest } from './contracts';
import {
  createAuthorizationHeaders,
  DEFAULT_CLIENT_NAME,
  DEFAULT_DEVICE_NAME,
  type MediaBrowserAuthorizationOptions,
} from './authorization';
import { createIinaDeviceProfile } from './device-profile';
import { encodeQuery } from './portable-url';
import { joinJellyfinPath } from './url';

export interface HttpRequest<TBody = unknown> {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: TBody;
}

export interface ClientIdentity {
  deviceId: string;
  version: string;
  client?: string;
  device?: string;
}

export interface AuthenticatedApiContext extends ClientIdentity {
  serverUrl: string;
  accessToken: string;
  userId: string;
}

function authorizationOptions(
  identity: ClientIdentity,
  accessToken?: string,
): MediaBrowserAuthorizationOptions {
  const result: MediaBrowserAuthorizationOptions = {
    client: identity.client ?? DEFAULT_CLIENT_NAME,
    device: identity.device ?? DEFAULT_DEVICE_NAME,
    deviceId: identity.deviceId,
    version: identity.version,
  };
  if (accessToken !== undefined) result.accessToken = accessToken;
  return result;
}

function jsonHeaders(identity: ClientIdentity, accessToken?: string): Record<string, string> {
  return {
    ...createAuthorizationHeaders(authorizationOptions(identity, accessToken)),
    'Content-Type': 'application/json',
  };
}

function withQuery(
  url: string,
  values: Record<string, string | number | boolean | undefined>,
): string {
  const query = encodeQuery(values);
  return query === '' ? url : `${url}?${query}`;
}

function itemFields(): string {
  return [
    'Overview',
    'Genres',
    'People',
    'DateCreated',
    'PremiereDate',
    'ProductionYear',
    'RunTimeTicks',
    'LocationType',
    'IsPlaceHolder',
    'MediaSources',
    'MediaStreams',
    'ProviderIds',
    'CommunityRating',
  ].join(',');
}

function authenticatedHeaders(context: AuthenticatedApiContext): Record<string, string> {
  return createAuthorizationHeaders(authorizationOptions(context, context.accessToken));
}

export function buildPublicServerInfoRequest(serverUrl: string): HttpRequest {
  return {
    method: 'GET',
    url: joinJellyfinPath(serverUrl, 'System/Info/Public'),
    headers: { Accept: 'application/json' },
  };
}

export function buildPasswordAuthenticationRequest(
  serverUrl: string,
  identity: ClientIdentity,
  credentials: { username: string; password: string },
): HttpRequest<{ Username: string; Pw: string }> {
  return {
    method: 'POST',
    url: joinJellyfinPath(serverUrl, 'Users/AuthenticateByName'),
    headers: jsonHeaders(identity),
    body: { Username: credentials.username, Pw: credentials.password },
  };
}

export function buildQuickConnectInitiateRequest(
  serverUrl: string,
  identity: ClientIdentity,
): HttpRequest {
  return {
    method: 'POST',
    url: joinJellyfinPath(serverUrl, 'QuickConnect/Initiate'),
    headers: jsonHeaders(identity),
    body: {},
  };
}

export function buildQuickConnectStatusRequest(
  serverUrl: string,
  identity: ClientIdentity,
  secret: string,
): HttpRequest {
  return {
    method: 'GET',
    url: withQuery(joinJellyfinPath(serverUrl, 'QuickConnect/Connect'), { Secret: secret }),
    headers: createAuthorizationHeaders(authorizationOptions(identity)),
  };
}

export function buildQuickConnectAuthenticationRequest(
  serverUrl: string,
  identity: ClientIdentity,
  secret: string,
): HttpRequest<{ Secret: string }> {
  return {
    method: 'POST',
    url: joinJellyfinPath(serverUrl, 'Users/AuthenticateWithQuickConnect'),
    headers: jsonHeaders(identity),
    body: { Secret: secret },
  };
}

export function buildSessionLogoutRequest(
  context: AuthenticatedApiContext,
): HttpRequest<Record<string, never>> {
  return {
    method: 'POST',
    url: joinJellyfinPath(context.serverUrl, 'Sessions/Logout'),
    headers: jsonHeaders(context, context.accessToken),
    body: {},
  };
}

export function buildCatalogRequest(
  rawRequest: CatalogRequest,
  context: AuthenticatedApiContext,
): HttpRequest {
  const request = rawRequest;
  const userId = encodeURIComponent(context.userId);
  const headers = authenticatedHeaders(context);
  const fields = itemFields();

  switch (request.kind) {
    case 'libraries':
      return {
        method: 'GET',
        url: joinJellyfinPath(context.serverUrl, `Users/${userId}/Views`),
        headers,
      };
    case 'home': {
      if (request.shelf === 'continueWatching') {
        return {
          method: 'GET',
          url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items/Resume`), {
            IncludeItemTypes: 'Movie,Episode',
            Fields: fields,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            Limit: request.limit,
          }),
          headers,
        };
      }
      if (request.shelf === 'nextUp') {
        return {
          method: 'GET',
          url: withQuery(joinJellyfinPath(context.serverUrl, 'Shows/NextUp'), {
            UserId: context.userId,
            Fields: fields,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            Limit: request.limit,
            SeriesId: request.seriesId,
          }),
          headers,
        };
      }
      return {
        method: 'GET',
        url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items/Latest`), {
          IncludeItemTypes: 'Movie,Series,Episode',
          Fields: fields,
          ImageTypeLimit: 1,
          EnableImageTypes: 'Primary,Backdrop,Thumb',
          Limit: request.limit,
        }),
        headers,
      };
    }
    case 'library':
      return {
        method: 'GET',
        url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items`), {
          ParentId: request.parentId,
          IncludeItemTypes: request.itemType,
          Recursive: true,
          Fields: fields,
          ImageTypeLimit: 1,
          EnableImageTypes: 'Primary,Backdrop,Thumb',
          StartIndex: request.startIndex,
          Limit: request.limit,
          SortBy: request.sortBy,
          SortOrder: request.sortOrder,
          EnableTotalRecordCount: true,
        }),
        headers,
      };
    case 'search':
      return {
        method: 'GET',
        url: withQuery(joinJellyfinPath(context.serverUrl, `Users/${userId}/Items`), {
          SearchTerm: request.query,
          IncludeItemTypes: request.includeItemTypes.join(','),
          Recursive: true,
          IsMissing: false,
          Fields: fields,
          ImageTypeLimit: 1,
          EnableImageTypes: 'Primary,Backdrop,Thumb',
          StartIndex: request.startIndex,
          Limit: request.limit,
          EnableTotalRecordCount: true,
        }),
        headers,
      };
    case 'details':
      return {
        method: 'GET',
        url: withQuery(
          joinJellyfinPath(
            context.serverUrl,
            `Users/${userId}/Items/${encodeURIComponent(request.itemId)}`,
          ),
          { Fields: fields },
        ),
        headers,
      };
    case 'episodes':
      return {
        method: 'GET',
        url: withQuery(
          joinJellyfinPath(
            context.serverUrl,
            `Shows/${encodeURIComponent(request.seriesId)}/Episodes`,
          ),
          {
            UserId: context.userId,
            SeasonId: request.seasonId,
            IsMissing: false,
            EnableUserData: true,
            Fields: fields,
            StartIndex: request.startIndex,
            Limit: request.limit,
            EnableTotalRecordCount: true,
          },
        ),
        headers,
      };
  }
}

export function buildArtworkHttpRequest(
  rawRequest: ArtworkRequest,
  context: AuthenticatedApiContext,
): HttpRequest {
  const request = rawRequest;
  return {
    method: 'GET',
    url: withQuery(
      joinJellyfinPath(
        context.serverUrl,
        `Items/${encodeURIComponent(request.itemId)}/Images/${request.imageType}`,
      ),
      {
        tag: request.imageTag,
        maxWidth: request.width,
        maxHeight: request.height,
        quality: request.quality,
      },
    ),
    headers: authenticatedHeaders(context),
  };
}

export interface PlaybackInfoRequestBody {
  UserId: string;
  StartTimeTicks: number;
  MediaSourceId?: string;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
  MaxStreamingBitrate: number;
  EnableDirectPlay: true;
  EnableDirectStream: true;
  EnableTranscoding: true;
  AllowVideoStreamCopy: true;
  AllowAudioStreamCopy: true;
  AutoOpenLiveStream: false;
  DeviceProfile: ReturnType<typeof createIinaDeviceProfile>;
}

export function buildPlaybackInfoRequest(
  request: PlaybackRequest,
  context: AuthenticatedApiContext,
): HttpRequest<PlaybackInfoRequestBody> {
  const body: PlaybackInfoRequestBody = {
    UserId: context.userId,
    StartTimeTicks: request.startPositionTicks,
    MaxStreamingBitrate: request.maxStreamingBitrate,
    EnableDirectPlay: true,
    EnableDirectStream: true,
    EnableTranscoding: true,
    AllowVideoStreamCopy: true,
    AllowAudioStreamCopy: true,
    AutoOpenLiveStream: false,
    DeviceProfile: createIinaDeviceProfile(request.maxStreamingBitrate),
  };
  if (request.mediaSourceId !== undefined) body.MediaSourceId = request.mediaSourceId;
  if (request.audioStreamIndex !== undefined) body.AudioStreamIndex = request.audioStreamIndex;
  if (request.subtitleStreamIndex !== undefined)
    body.SubtitleStreamIndex = request.subtitleStreamIndex;

  return {
    method: 'POST',
    url: withQuery(
      joinJellyfinPath(
        context.serverUrl,
        `Items/${encodeURIComponent(request.itemId)}/PlaybackInfo`,
      ),
      {
        UserId: context.userId,
      },
    ),
    headers: jsonHeaders(context, context.accessToken),
    body,
  };
}
