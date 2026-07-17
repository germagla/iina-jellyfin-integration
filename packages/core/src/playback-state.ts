import { z } from 'zod';
import { PlayMethodSchema } from './contracts';

export const PLAYBACK_STATE_MESSAGE = 'playback.state';
export const PLAYBACK_STATE_REMOVED_MESSAGE = 'playback.state.removed';
export const MAX_PUBLIC_PLAYBACK_STATE_CHARS = 8_192;

const safeTicks = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const safeIndex = z.number().int().nonnegative().max(1_000_000);
const safeText = z.string().trim().min(1).max(512);

export const PublicPlaybackStateSchema = z
  .object({
    version: z.literal(1),
    playbackId: z.string().trim().min(1).max(128),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    generation: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(['preparing', 'playing', 'paused', 'stopped', 'error']),
    itemId: z.string().trim().min(1).max(512),
    positionTicks: safeTicks,
    durationTicks: safeTicks.optional(),
    playbackRate: z.number().finite().min(0.01).max(100).optional(),
    isBuffering: z.boolean().optional(),
    title: safeText,
    seriesName: safeText.optional(),
    seasonNumber: safeIndex.optional(),
    episodeNumber: safeIndex.optional(),
    playMethod: PlayMethodSchema,
    stopReason: z.enum(['completed', 'closed', 'replaced', 'failed', 'user']).optional(),
    startedAtMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    updatedAtMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type PublicPlaybackState = z.infer<typeof PublicPlaybackStateSchema>;

export const PublicPlaybackStateRemovalSchema = z
  .object({
    version: z.literal(1),
    playbackId: z.string().trim().min(1).max(128),
    generation: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    removedAtMs: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type PublicPlaybackStateRemoval = z.infer<typeof PublicPlaybackStateRemovalSchema>;

export function parsePublicPlaybackState(value: unknown): PublicPlaybackState | undefined {
  let candidate = value;
  if (typeof value === 'string') {
    if (value.length === 0 || value.length > MAX_PUBLIC_PLAYBACK_STATE_CHARS) return undefined;
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }
  const parsed = PublicPlaybackStateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

export function serializePublicPlaybackState(state: PublicPlaybackState): string {
  return JSON.stringify(PublicPlaybackStateSchema.parse(state));
}

export function parsePublicPlaybackStateRemoval(
  value: unknown,
): PublicPlaybackStateRemoval | undefined {
  const parsed = PublicPlaybackStateRemovalSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
