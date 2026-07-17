import { z } from 'zod';
import { hasSecretQueryParameter, isAbsoluteHttpUrl } from './portable-url';

const safeTicks = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identifier = z.string().trim().min(1).max(256);
const absoluteHttpUrl = z.string().refine(isAbsoluteHttpUrl, { message: 'Invalid URL' });
const credentialSafeAbsoluteHttpUrl = absoluteHttpUrl.refine(
  (url) => !hasSecretQueryParameter(url),
  { message: 'URL query parameters must not contain credentials' },
);

export const ConnectionMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    serverUrl: absoluteHttpUrl,
    serverId: identifier,
    serverName: z.string().trim().min(1).max(256),
    userId: identifier,
    username: z.string().trim().min(1).max(256),
    deviceId: identifier,
    acceptedInsecureRemote: z.boolean(),
    lastConnectedAt: z.string().datetime(),
  })
  .strict();

export type ConnectionMetadata = z.infer<typeof ConnectionMetadataSchema>;

const PageSchema = z.object({
  startIndex: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(200).default(50),
});

export const CatalogRequestSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('libraries'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('home'),
      shelf: z.enum(['continueWatching', 'nextUp', 'recentlyAdded']),
      limit: z.number().int().min(1).max(50).default(20),
      seriesId: identifier.optional(),
    })
    .strict(),
  PageSchema.extend({
    kind: z.literal('library'),
    itemType: z.enum(['Movie', 'Series']),
    parentId: identifier,
    sortBy: z
      .enum(['SortName', 'DateCreated', 'PremiereDate', 'CommunityRating'])
      .default('SortName'),
    sortOrder: z.enum(['Ascending', 'Descending']).default('Ascending'),
  }).strict(),
  PageSchema.extend({
    kind: z.literal('search'),
    query: z.string().trim().min(1).max(200),
    includeItemTypes: z
      .array(z.enum(['Movie', 'Series', 'Episode']))
      .min(1)
      .max(3)
      .default(['Movie', 'Series']),
  }).strict(),
  z
    .object({
      kind: z.literal('details'),
      itemId: identifier,
    })
    .strict(),
  PageSchema.extend({
    kind: z.literal('episodes'),
    seriesId: identifier,
    seasonId: identifier.optional(),
  }).strict(),
]);

export type CatalogRequest = z.infer<typeof CatalogRequestSchema>;

export const ArtworkRequestSchema = z
  .object({
    itemId: identifier,
    imageType: z.enum(['Primary', 'Backdrop', 'Thumb', 'Logo']),
    imageTag: z.string().trim().min(1).max(512).optional(),
    width: z.number().int().min(32).max(2048),
    height: z.number().int().min(32).max(2048),
    quality: z.number().int().min(40).max(95).default(85),
  })
  .strict()
  .refine(({ width, height }) => width * height <= 4_194_304, {
    message: 'Artwork dimensions exceed the four-megapixel limit',
  });

export type ArtworkRequest = z.infer<typeof ArtworkRequestSchema>;

export const PlaybackRequestSchema = z
  .object({
    itemId: identifier,
    startPositionTicks: safeTicks.default(0),
    mediaSourceId: identifier.optional(),
    audioStreamIndex: z.number().int().nonnegative().max(10_000).optional(),
    subtitleStreamIndex: z.number().int().min(-1).max(10_000).optional(),
    maxStreamingBitrate: z.number().int().min(1_000_000).max(1_000_000_000).default(120_000_000),
    openInNewWindow: z.boolean().default(false),
    videoTranscodeConfirmationId: identifier.optional(),
  })
  .strict();

export type PlaybackRequest = z.infer<typeof PlaybackRequestSchema>;

export const PlayMethodSchema = z.enum(['DirectPlay', 'DirectStream', 'Transcode']);
export type PlayMethod = z.infer<typeof PlayMethodSchema>;

export const PlaybackPlanSchema = z
  .object({
    itemId: identifier,
    playSessionId: identifier,
    mediaSourceId: identifier,
    url: credentialSafeAbsoluteHttpUrl,
    headers: z.record(z.string()),
    playMethod: PlayMethodSchema,
    conversion: z.enum(['none', 'container', 'audio', 'video']),
    requiresVideoTranscodeConfirmation: z.boolean(),
    transcodeReasons: z.array(z.string()),
    startPositionTicks: safeTicks,
    audioStreamIndex: z.number().int().nonnegative().max(10_000).optional(),
    subtitleStreamIndex: z.number().int().min(-1).max(10_000).optional(),
    externalSubtitle: z
      .object({
        index: z.number().int().nonnegative(),
        deliveryUrl: credentialSafeAbsoluteHttpUrl,
        codec: z.string().optional(),
        language: z.string().optional(),
        displayTitle: z.string().optional(),
      })
      .strict()
      .optional(),
    runtimeTicks: safeTicks.optional(),
  })
  .strict();

export type PlaybackPlan = z.infer<typeof PlaybackPlanSchema>;

export const PlaybackSessionStateSchema = z
  .object({
    generation: z.number().int().nonnegative(),
    status: z.enum(['idle', 'preparing', 'playing', 'paused', 'stopped', 'error']),
    plan: PlaybackPlanSchema.optional(),
    positionTicks: safeTicks,
    durationTicks: safeTicks.optional(),
    lastProgressReportAtMs: z.number().int().nonnegative().optional(),
    stopReason: z.enum(['completed', 'closed', 'replaced', 'failed', 'user']).optional(),
    errorMessage: z.string().max(2_000).optional(),
  })
  .strict();

export type PlaybackSessionState = z.infer<typeof PlaybackSessionStateSchema>;

export const BridgeOperationSchema = z.enum([
  'connection.probe',
  'connection.login.password',
  'connection.quickConnect.start',
  'connection.quickConnect.poll',
  'connection.disconnect',
  'catalog.query',
  'artwork.fetch',
  'playback.start',
  'playback.stop',
  'catalog.refresh',
]);

export type BridgeOperation = z.infer<typeof BridgeOperationSchema>;

const requestId = z.string().trim().min(1).max(128);

export const BridgeRequestSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('connection.probe'),
      requestId,
      payload: z
        .object({
          serverUrl: z.string().min(1).max(2_048),
          allowInsecureRemote: z.boolean().default(false),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('connection.login.password'),
      requestId,
      payload: z
        .object({
          serverUrl: z.string().min(1).max(2_048),
          username: z.string().min(1).max(256),
          password: z.string().max(4_096),
          allowInsecureRemote: z.boolean().default(false),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('connection.quickConnect.start'),
      requestId,
      payload: z
        .object({
          serverUrl: z.string().min(1).max(2_048),
          allowInsecureRemote: z.boolean().default(false),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('connection.quickConnect.poll'),
      requestId,
      payload: z.object({}).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal('connection.disconnect'),
      requestId,
      payload: z.object({}).strict(),
    })
    .strict(),
  z
    .object({ operation: z.literal('catalog.query'), requestId, payload: CatalogRequestSchema })
    .strict(),
  z
    .object({ operation: z.literal('artwork.fetch'), requestId, payload: ArtworkRequestSchema })
    .strict(),
  z
    .object({ operation: z.literal('playback.start'), requestId, payload: PlaybackRequestSchema })
    .strict(),
  z
    .object({
      operation: z.literal('playback.stop'),
      requestId,
      payload: z
        .object({ reason: z.enum(['closed', 'replaced', 'user']).default('user') })
        .strict(),
    })
    .strict(),
  z
    .object({ operation: z.literal('catalog.refresh'), requestId, payload: z.object({}).strict() })
    .strict(),
]);

export type BridgeRequest = z.infer<typeof BridgeRequestSchema>;

export const BridgeErrorSchema = z
  .object({
    code: z.string().trim().min(1).max(128),
    message: z.string().trim().min(1).max(2_000),
    recoverable: z.boolean(),
    details: z.unknown().optional(),
  })
  .strict();

export type BridgeError = z.infer<typeof BridgeErrorSchema>;

export const BridgeResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      operation: BridgeOperationSchema,
      requestId,
      ok: z.literal(true),
      result: z.unknown(),
    })
    .strict(),
  z
    .object({
      operation: BridgeOperationSchema,
      requestId,
      ok: z.literal(false),
      error: BridgeErrorSchema,
    })
    .strict(),
]);

export type BridgeResponse<T = unknown> =
  | { operation: BridgeOperation; requestId: string; ok: true; result: T }
  | { operation: BridgeOperation; requestId: string; ok: false; error: BridgeError };

export function parseBridgeRequest(input: unknown): BridgeRequest {
  return BridgeRequestSchema.parse(input);
}

export function parseBridgeResponse(input: unknown): BridgeResponse {
  return BridgeResponseSchema.parse(input) as BridgeResponse;
}
