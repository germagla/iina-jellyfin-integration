import {
  createAuthorizationHeaders,
  createMediaBrowserAuthorization,
  DEFAULT_CLIENT_NAME,
  DEFAULT_DEVICE_NAME,
} from './authorization';
import type { AuthenticatedApiContext, HttpRequest } from './api';
import {
  PlaybackPlanSchema,
  type PlaybackPlan,
  type PlaybackRequest,
  type PlaybackSessionState,
  type PlayMethod,
} from './contracts';
import {
  PlaybackInfoResponseSchema,
  type MediaSource,
  type PlaybackInfoResponse,
} from './jellyfin-schemas';
import { clampPositionTicks } from './ticks';
import { joinJellyfinPath, resolveJellyfinUrl } from './url';

export type PlaybackSelectionErrorCode = 'MEDIA_SOURCE_NOT_FOUND' | 'NO_PLAYABLE_URL';

export class PlaybackSelectionError extends Error {
  readonly code: PlaybackSelectionErrorCode;

  constructor(code: PlaybackSelectionErrorCode, message: string) {
    super(message);
    this.name = 'PlaybackSelectionError';
    this.code = code;
  }
}

function chooseMediaSource(response: PlaybackInfoResponse, requestedId?: string): MediaSource {
  if (requestedId === undefined) return response.MediaSources[0] as MediaSource;
  const selected = response.MediaSources.find((source) => source.Id === requestedId);
  if (selected === undefined) {
    throw new PlaybackSelectionError(
      'MEDIA_SOURCE_NOT_FOUND',
      'The selected media version is no longer available',
    );
  }
  return selected;
}

function queryValueCaseInsensitive(url: string, name: string): string | undefined {
  const parsed = new URL(url, 'https://jellyfin.invalid');
  const wanted = name.toLowerCase();
  for (const [key, value] of parsed.searchParams) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function transcodeReasonsFromUrl(url: string): string[] {
  const value = queryValueCaseInsensitive(url, 'TranscodeReasons');
  if (value === undefined) return [];
  return value
    .split(',')
    .map((reason) => reason.trim())
    .filter((reason) => reason.length > 0)
    .slice(0, 32);
}

function staticDirectPlayUrl(
  context: AuthenticatedApiContext,
  request: PlaybackRequest,
  source: MediaSource,
  playSessionId: string,
): string {
  const query = new URLSearchParams({
    Static: 'true',
    MediaSourceId: source.Id,
    PlaySessionId: playSessionId,
  });
  return `${joinJellyfinPath(context.serverUrl, `Videos/${encodeURIComponent(request.itemId)}/stream`)}?${query}`;
}

function determineTranscodeConversion(
  source: MediaSource,
  transcodeUrl: string,
): 'audio' | 'container' | 'video' {
  const containsVideo = source.MediaStreams.some((stream) => stream.Type === 'Video');
  if (!containsVideo) return 'audio';

  const videoCodec = queryValueCaseInsensitive(transcodeUrl, 'VideoCodec')?.toLowerCase();
  const audioCodec = queryValueCaseInsensitive(transcodeUrl, 'AudioCodec')?.toLowerCase();
  if (videoCodec !== undefined) {
    if (videoCodec === 'copy')
      return audioCodec === undefined || audioCodec === 'copy' ? 'container' : 'audio';
    return 'video';
  }

  const reasons = transcodeReasonsFromUrl(transcodeUrl);
  if (reasons.some((reason) => /video|bitrate|subtitle/i.test(reason))) return 'video';
  if (reasons.length > 0 && reasons.every((reason) => /audio/i.test(reason))) return 'audio';
  if (reasons.length > 0 && reasons.every((reason) => /container/i.test(reason)))
    return 'container';

  // A missing VideoCodec is ambiguous across Jellyfin versions. Requiring the
  // video-transcode confirmation is safer than silently initiating re-encoding.
  return 'video';
}

function selectedAudioIndex(request: PlaybackRequest, source: MediaSource): number | undefined {
  if (request.audioStreamIndex !== undefined) return request.audioStreamIndex;
  return source.DefaultAudioStreamIndex ?? undefined;
}

function selectedSubtitleIndex(request: PlaybackRequest, source: MediaSource): number | undefined {
  if (request.subtitleStreamIndex !== undefined) return request.subtitleStreamIndex;
  return source.DefaultSubtitleStreamIndex ?? undefined;
}

function requiredHeaders(
  source: MediaSource,
  context: AuthenticatedApiContext,
): Record<string, string> {
  const allowedServerHeaders: Record<string, string> = {};
  for (const [name, value] of Object.entries(source.RequiredHttpHeaders ?? {})) {
    const normalized = name.toLowerCase();
    if (
      !/^[A-Za-z0-9-]{1,128}$/.test(name) ||
      /[\r\n]/.test(value) ||
      ['authorization', 'proxy-authorization', 'cookie', 'host'].includes(normalized)
    ) {
      continue;
    }
    allowedServerHeaders[name] = value;
  }
  return {
    ...allowedServerHeaders,
    Authorization: createMediaBrowserAuthorization({
      client: context.client ?? DEFAULT_CLIENT_NAME,
      device: context.device ?? DEFAULT_DEVICE_NAME,
      deviceId: context.deviceId,
      version: context.version,
      accessToken: context.accessToken,
    }),
  };
}

export function selectPlaybackPlan(
  rawResponse: unknown,
  request: PlaybackRequest,
  context: AuthenticatedApiContext,
): PlaybackPlan {
  const response = PlaybackInfoResponseSchema.parse(rawResponse);
  const source = chooseMediaSource(response, request.mediaSourceId);

  let url: string;
  let playMethod: PlayMethod;
  let conversion: PlaybackPlan['conversion'];

  if (source.SupportsDirectPlay) {
    url = staticDirectPlayUrl(context, request, source, response.PlaySessionId);
    playMethod = 'DirectPlay';
    conversion = 'none';
  } else if (source.SupportsTranscoding && source.TranscodingUrl) {
    url = source.TranscodingUrl;
    conversion = determineTranscodeConversion(source, source.TranscodingUrl);
    // Jellyfin reports remuxes and audio-only conversions with copied video as
    // DirectStream. Only video re-encoding is a Transcode play method.
    playMethod =
      source.SupportsDirectStream && conversion !== 'video' ? 'DirectStream' : 'Transcode';
  } else {
    throw new PlaybackSelectionError(
      'NO_PLAYABLE_URL',
      'Jellyfin did not return a playable URL for this media version',
    );
  }

  const audioStreamIndex = selectedAudioIndex(request, source);
  const subtitleStreamIndex = selectedSubtitleIndex(request, source);
  const plan: PlaybackPlan = {
    itemId: request.itemId,
    playSessionId: response.PlaySessionId,
    mediaSourceId: source.Id,
    url: resolveJellyfinUrl(context.serverUrl, url),
    headers: requiredHeaders(source, context),
    playMethod,
    conversion,
    requiresVideoTranscodeConfirmation: conversion === 'video',
    transcodeReasons:
      source.TranscodingUrl == null ? [] : transcodeReasonsFromUrl(source.TranscodingUrl),
    startPositionTicks: request.startPositionTicks,
  };
  if (audioStreamIndex !== undefined) plan.audioStreamIndex = audioStreamIndex;
  if (subtitleStreamIndex !== undefined) plan.subtitleStreamIndex = subtitleStreamIndex;
  if (source.RunTimeTicks != null) plan.runtimeTicks = source.RunTimeTicks;

  if (subtitleStreamIndex !== undefined && subtitleStreamIndex >= 0) {
    const subtitle = source.MediaStreams.find(
      (stream) =>
        stream.Type === 'Subtitle' &&
        stream.Index === subtitleStreamIndex &&
        stream.IsExternal === true,
    );
    if (subtitle?.DeliveryUrl) {
      const externalSubtitle: NonNullable<PlaybackPlan['externalSubtitle']> = {
        index: subtitle.Index,
        deliveryUrl: resolveJellyfinUrl(context.serverUrl, subtitle.DeliveryUrl),
      };
      if (subtitle.Codec) externalSubtitle.codec = subtitle.Codec;
      if (subtitle.Language) externalSubtitle.language = subtitle.Language;
      if (subtitle.DisplayTitle) externalSubtitle.displayTitle = subtitle.DisplayTitle;
      plan.externalSubtitle = externalSubtitle;
    }
  }

  return PlaybackPlanSchema.parse(plan);
}

export type PlaybackReportKind = 'start' | 'progress' | 'stopped';
export type PlaybackProgressEventName =
  | 'timeupdate'
  | 'pause'
  | 'unpause'
  | 'seek'
  | 'volumechange'
  | 'audiotrackchange'
  | 'subtitletrackchange';

export interface PlaybackTelemetry {
  isMuted?: boolean;
  volumeLevel?: number;
  canSeek?: boolean;
  eventName?: PlaybackProgressEventName;
  failed?: boolean;
}

export interface PlaybackReportPayload {
  ItemId: string;
  MediaSourceId: string;
  PlaySessionId: string;
  PositionTicks: number;
  CanSeek: boolean;
  IsPaused: boolean;
  IsMuted: boolean;
  IsPlaying: boolean;
  IsMediaSegmentAction: boolean;
  PlayMethod: PlayMethod;
  VolumeLevel: number;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
  EventName?: PlaybackProgressEventName;
  Failed?: boolean;
}

function normalizedVolume(level: number | undefined): number {
  if (level === undefined || !Number.isFinite(level)) return 100;
  return Math.max(0, Math.min(100, Math.round(level)));
}

export function buildPlaybackReportPayload(
  kind: PlaybackReportKind,
  state: PlaybackSessionState,
  telemetry: PlaybackTelemetry = {},
): PlaybackReportPayload {
  if (state.plan === undefined || state.status === 'idle' || state.status === 'preparing') {
    throw new Error('Playback cannot be reported before media has started');
  }

  const isStopped = kind === 'stopped' || state.status === 'stopped' || state.status === 'error';
  const payload: PlaybackReportPayload = {
    ItemId: state.plan.itemId,
    MediaSourceId: state.plan.mediaSourceId,
    PlaySessionId: state.plan.playSessionId,
    PositionTicks: clampPositionTicks(state.positionTicks, state.durationTicks),
    CanSeek: telemetry.canSeek ?? true,
    IsPaused: !isStopped && state.status === 'paused',
    IsMuted: telemetry.isMuted ?? false,
    IsPlaying: !isStopped && state.status === 'playing',
    IsMediaSegmentAction: false,
    PlayMethod: state.plan.playMethod,
    VolumeLevel: normalizedVolume(telemetry.volumeLevel),
  };
  if (state.plan.audioStreamIndex !== undefined)
    payload.AudioStreamIndex = state.plan.audioStreamIndex;
  if (state.plan.subtitleStreamIndex !== undefined)
    payload.SubtitleStreamIndex = state.plan.subtitleStreamIndex;
  if (kind === 'progress') payload.EventName = telemetry.eventName ?? 'timeupdate';
  if (kind === 'stopped') payload.Failed = telemetry.failed ?? state.status === 'error';
  return payload;
}

export function buildPlaybackReportRequest(
  kind: PlaybackReportKind,
  state: PlaybackSessionState,
  context: AuthenticatedApiContext,
  telemetry: PlaybackTelemetry = {},
): HttpRequest<PlaybackReportPayload> {
  const endpoint =
    kind === 'start'
      ? 'Sessions/Playing'
      : kind === 'progress'
        ? 'Sessions/Playing/Progress'
        : 'Sessions/Playing/Stopped';
  return {
    method: 'POST',
    url: joinJellyfinPath(context.serverUrl, endpoint),
    headers: {
      ...createAuthorizationHeaders({
        client: context.client ?? DEFAULT_CLIENT_NAME,
        device: context.device ?? DEFAULT_DEVICE_NAME,
        deviceId: context.deviceId,
        version: context.version,
        accessToken: context.accessToken,
      }),
      'Content-Type': 'application/json',
    },
    body: buildPlaybackReportPayload(kind, state, telemetry),
  };
}
