import {
  MAX_PUBLIC_PLAYBACK_STATE_CHARS,
  parsePublicPlaybackState,
  serializePublicPlaybackState,
  type PublicPlaybackState,
} from '@iina-jellyfin/core';

export const PLAYBACK_STATE_FILE_PREFIX = 'jellyfin-playback-state-';
const PLAYBACK_STATE_FILE_SUFFIX = '.json';
const SAFE_PLAYBACK_ID = /^[A-Za-z0-9-]{1,128}$/;

export interface PlaybackStateFileApi {
  list(
    path: string,
    options: { includeSubDir: boolean },
  ): { filename: string; path: string; isDir: boolean }[];
  read(path: string): string | undefined;
  write(path: string, content: string): void;
  delete(path: string): void;
}

export function playbackStatePath(playbackId: string): string {
  if (!SAFE_PLAYBACK_ID.test(playbackId)) throw new Error('Invalid public playback identifier.');
  return `@tmp/${PLAYBACK_STATE_FILE_PREFIX}${playbackId}${PLAYBACK_STATE_FILE_SUFFIX}`;
}

export function writePlaybackState(
  file: Pick<PlaybackStateFileApi, 'write'>,
  state: PublicPlaybackState,
): void {
  file.write(playbackStatePath(state.playbackId), serializePublicPlaybackState(state));
}

export function readPlaybackStates(
  file: Pick<PlaybackStateFileApi, 'read'>,
  allowedPlaybackIds: ReadonlySet<string>,
  maximumFiles = 64,
): PublicPlaybackState[] {
  if (!Number.isSafeInteger(maximumFiles) || maximumFiles < 1) return [];
  const states: PublicPlaybackState[] = [];
  for (const playbackId of allowedPlaybackIds) {
    if (states.length >= maximumFiles) break;
    try {
      const raw = file.read(playbackStatePath(playbackId));
      if (raw === undefined || raw.length > MAX_PUBLIC_PLAYBACK_STATE_CHARS) continue;
      const state = parsePublicPlaybackState(raw);
      if (state?.playbackId === playbackId) states.push(state);
    } catch {
      // A player may not have created its mailbox yet, or may have removed it
      // while this pass was reading concurrent sessions. Keep reading the other
      // exact allowlisted paths instead of hiding every active playback.
    }
  }
  return states;
}

export function prunePlaybackStateFiles(
  file: Pick<PlaybackStateFileApi, 'list' | 'delete'>,
  retainedPlaybackIds: ReadonlySet<string> = new Set(),
): void {
  const pattern = new RegExp(
    `^${PLAYBACK_STATE_FILE_PREFIX}([A-Za-z0-9-]{1,128})\\${PLAYBACK_STATE_FILE_SUFFIX}$`,
  );
  try {
    for (const entry of file.list('@tmp/', { includeSubDir: false })) {
      if (entry.isDir) continue;
      const playbackId = pattern.exec(entry.filename)?.[1];
      if (playbackId === undefined || retainedPlaybackIds.has(playbackId)) continue;
      try {
        file.delete(playbackStatePath(playbackId));
      } catch {
        // Cleanup is best-effort and is restricted to exact mailbox filenames.
      }
    }
  } catch {
    // Listing may be unavailable in a constrained IINA context.
  }
}
