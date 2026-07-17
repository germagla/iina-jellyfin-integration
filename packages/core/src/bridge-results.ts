import { z } from 'zod';
import type { BridgeOperation } from './contracts';
import { PlayMethodSchema } from './contracts';
import { BaseItemSchema, ItemsResultSchema, PublicSystemInfoSchema } from './jellyfin-schemas';
import { isAbsoluteHttpUrl } from './portable-url';

const identifier = z.string().trim().min(1).max(512);
const absoluteHttpUrl = z.string().max(2_048).refine(isAbsoluteHttpUrl, {
  message: 'Invalid URL',
});
const publicConnection = z
  .object({
    serverUrl: absoluteHttpUrl,
    serverId: identifier,
    serverName: z.string().min(1).max(256),
    userId: identifier,
    username: z.string().min(1).max(256),
    transport: z.enum(['http', 'https']),
    lastConnectedAt: z.string().datetime({ offset: true }),
  })
  .strip();

export const PublicPlaybackPlanSchema = z
  .object({
    playMethod: PlayMethodSchema,
    conversion: z.enum(['none', 'container', 'audio', 'video']),
    requiresVideoTranscodeConfirmation: z.boolean(),
    transcodeReasons: z.array(z.string().max(512)).max(32),
    mediaSourceId: identifier,
    audioStreamIndex: z.number().int().nonnegative().max(10_000).optional(),
    subtitleStreamIndex: z.number().int().min(-1).max(10_000).optional(),
  })
  .strip();

const resultSchemas = {
  'connection.probe': z
    .object({
      server: PublicSystemInfoSchema,
      normalizedUrl: absoluteHttpUrl,
      transportPolicy: z.enum(['https', 'local-http-warning', 'remote-http-accepted']),
      isLocal: z.boolean(),
    })
    .strict(),
  'connection.login.password': z.object({ connection: publicConnection }).strict(),
  'connection.quickConnect.start': z
    .object({
      code: z.string().min(1).max(32),
      serverName: z.string().min(1).max(256),
      expiresInSeconds: z.number().int().min(1).max(3_600),
    })
    .strict(),
  'connection.quickConnect.poll': z
    .object({ authenticated: z.boolean(), connection: publicConnection.optional() })
    .strict()
    .superRefine((value, context) => {
      if (value.authenticated && value.connection === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Authenticated Quick Connect results require public connection metadata',
        });
      }
    }),
  'connection.disconnect': z.object({ disconnected: z.literal(true) }).strict(),
  'catalog.query': z.union([BaseItemSchema, ItemsResultSchema, z.array(BaseItemSchema).max(200)]),
  'artwork.fetch': z
    .object({
      dataUrl: z
        .string()
        .max(12_000_000)
        .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
    })
    .strict(),
  'playback.start': z.discriminatedUnion('status', [
    z
      .object({
        status: z.literal('started'),
        playbackId: identifier,
        plan: PublicPlaybackPlanSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal('confirmation-required'),
        plan: PublicPlaybackPlanSchema,
        confirmationId: identifier,
      })
      .strict(),
  ]),
  'playback.stop': z.object({ stopped: z.literal(true) }).strict(),
  'catalog.refresh': z
    .object({
      connection: publicConnection.optional(),
      refreshedAt: z.string().datetime({ offset: true }),
    })
    .strict(),
} satisfies Record<BridgeOperation, z.ZodTypeAny>;

export type BridgeResultMap = {
  [Operation in BridgeOperation]: z.infer<(typeof resultSchemas)[Operation]>;
};

export function parseBridgeResult<Operation extends BridgeOperation>(
  operation: Operation,
  value: unknown,
): BridgeResultMap[Operation] {
  return resultSchemas[operation].parse(value) as BridgeResultMap[Operation];
}
