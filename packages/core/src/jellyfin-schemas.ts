import { z } from 'zod';

const identifier = z.string().min(1).max(512);
const shortText = z.string().max(2_000);
const imageTags = z
  .record(z.string().max(512))
  .transform((value) => Object.fromEntries(Object.entries(value).slice(0, 16)));

export const PublicSystemInfoSchema = z
  .object({
    Id: identifier,
    ServerName: z.string().min(1).max(256),
    Version: z.string().min(1).max(128),
    ProductName: z.string().max(256).optional(),
    OperatingSystem: z.string().max(256).optional(),
    StartupWizardCompleted: z.boolean().optional(),
  })
  .strip();

export type PublicSystemInfo = z.infer<typeof PublicSystemInfoSchema>;

export const AuthenticationResultSchema = z
  .object({
    User: z
      .object({
        Id: identifier,
        Name: z.string().min(1).max(256),
      })
      .strip(),
    AccessToken: z.string().min(1).max(8_192),
    ServerId: identifier,
    SessionInfo: z.object({ Id: identifier.optional() }).strip().optional(),
  })
  .strip();

export type AuthenticationResult = z.infer<typeof AuthenticationResultSchema>;

const PublicMediaStreamSchema = z
  .object({
    Index: z.number().int().nonnegative(),
    Type: z.enum(['Audio', 'Video', 'Subtitle', 'EmbeddedImage', 'Data']),
    Codec: z.string().max(128).nullable().optional(),
    Language: z.string().max(128).nullable().optional(),
    DisplayTitle: z.string().max(512).nullable().optional(),
    IsDefault: z.boolean().optional(),
    IsExternal: z.boolean().optional(),
  })
  .strip();

const PublicMediaSourceSummarySchema = z
  .object({
    Id: identifier,
    Name: z.string().max(512).optional(),
    Container: z.string().max(128).nullable().optional(),
    MediaStreams: z.array(PublicMediaStreamSchema).max(100).default([]),
  })
  .strip();

export const BaseItemSchema = z
  .object({
    Id: identifier,
    Name: z.string().max(2_000),
    Type: z.string().max(128).optional(),
    Overview: z.string().max(20_000).nullable().optional(),
    RunTimeTicks: z.number().int().nonnegative().nullable().optional(),
    ProductionYear: z.number().int().nullable().optional(),
    IndexNumber: z.number().int().nullable().optional(),
    ParentIndexNumber: z.number().int().nullable().optional(),
    SeriesName: shortText.nullable().optional(),
    SeriesId: identifier.nullable().optional(),
    ParentBackdropItemId: identifier.nullable().optional(),
    OfficialRating: z.string().max(128).nullable().optional(),
    CommunityRating: z.number().finite().nullable().optional(),
    UnwatchedCount: z.number().int().nonnegative().optional(),
    ImageTags: imageTags.optional(),
    BackdropImageTags: z.array(z.string().max(512)).max(8).optional(),
    MediaSources: z.array(PublicMediaSourceSummarySchema).max(20).optional(),
    UserData: z
      .object({
        PlaybackPositionTicks: z.number().int().nonnegative().optional(),
        Played: z.boolean().optional(),
        PlayedPercentage: z.number().nonnegative().nullable().optional(),
        UnplayedItemCount: z.number().int().nonnegative().nullable().optional(),
      })
      .strip()
      .optional(),
  })
  .strip();

export type BaseItem = z.infer<typeof BaseItemSchema>;

export const ItemsResultSchema = z
  .object({
    Items: z.array(BaseItemSchema).max(200),
    TotalRecordCount: z.number().int().nonnegative(),
    StartIndex: z.number().int().nonnegative(),
  })
  .strip();

export type ItemsResult = z.infer<typeof ItemsResultSchema>;

export const MediaStreamSchema = z
  .object({
    Index: z.number().int().nonnegative(),
    Type: z.enum(['Audio', 'Video', 'Subtitle', 'EmbeddedImage', 'Data']),
    Codec: z.string().max(128).nullable().optional(),
    Language: z.string().max(128).nullable().optional(),
    DisplayTitle: z.string().max(512).nullable().optional(),
    IsDefault: z.boolean().optional(),
    IsExternal: z.boolean().optional(),
    DeliveryUrl: z.string().max(8_192).nullable().optional(),
  })
  .strip();

export const MediaSourceSchema = z
  .object({
    Id: identifier,
    Name: z.string().max(512).optional(),
    Protocol: z.string().max(128).optional(),
    Container: z.string().max(128).nullable().optional(),
    Path: z.string().max(8_192).nullable().optional(),
    RunTimeTicks: z.number().int().nonnegative().nullable().optional(),
    SupportsDirectPlay: z.boolean().default(false),
    SupportsDirectStream: z.boolean().default(false),
    SupportsTranscoding: z.boolean().default(false),
    TranscodingUrl: z.string().max(16_384).nullable().optional(),
    TranscodingContainer: z.string().max(128).nullable().optional(),
    TranscodingSubProtocol: z.string().max(128).nullable().optional(),
    RequiredHttpHeaders: z
      .record(z.string().max(8_192))
      .refine((headers) => Object.keys(headers).length <= 64, 'Too many required HTTP headers')
      .optional(),
    DefaultAudioStreamIndex: z.number().int().nonnegative().nullable().optional(),
    DefaultSubtitleStreamIndex: z.number().int().min(-1).nullable().optional(),
    MediaStreams: z.array(MediaStreamSchema).max(100).default([]),
  })
  .strip();

export type MediaSource = z.infer<typeof MediaSourceSchema>;

export const PlaybackInfoResponseSchema = z
  .object({
    PlaySessionId: identifier,
    MediaSources: z.array(MediaSourceSchema).min(1).max(20),
    ErrorCode: z.string().max(256).nullable().optional(),
  })
  .strip();

export type PlaybackInfoResponse = z.infer<typeof PlaybackInfoResponseSchema>;
