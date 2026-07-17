import { describe, expect, it, vi } from 'vitest';
import type { PublicPlaybackState } from '@iina-jellyfin/core';
import {
  playbackStatePath,
  prunePlaybackStateFiles,
  readPlaybackStates,
  writePlaybackState,
} from '../src/playback-state-mailbox';

const state: PublicPlaybackState = {
  version: 1,
  playbackId: 'play-safe-123',
  sequence: 3,
  generation: 1,
  status: 'playing',
  itemId: 'episode-1',
  positionTicks: 100,
  durationTicks: 1_000,
  title: 'Episode One',
  playMethod: 'DirectPlay',
  startedAtMs: 1_000,
  updatedAtMs: 2_000,
};

function fileApi(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  return {
    files,
    list: vi.fn(() =>
      [...files.keys()].map((path) => ({
        filename: path.slice('@tmp/'.length),
        path,
        isDir: false,
      })),
    ),
    read: vi.fn((path: string) => files.get(path)),
    write: vi.fn((path: string, value: string) => files.set(path, value)),
    delete: vi.fn((path: string) => files.delete(path)),
  };
}

describe('playback state mailbox', () => {
  it('writes and reads only allowed, strictly validated playback snapshots', () => {
    const file = fileApi();
    writePlaybackState(file, state);
    file.files.set('@tmp/jellyfin-playback-state-unknown.json', JSON.stringify({ ...state }));
    file.files.set('@tmp/jellyfin-playback-state-malformed.json', '{bad-json');
    file.files.set('@tmp/unrelated.json', JSON.stringify(state));

    expect(readPlaybackStates(file, new Set([state.playbackId]))).toEqual([state]);
    expect(file.read).toHaveBeenCalledWith(playbackStatePath(state.playbackId));
    expect(file.read).not.toHaveBeenCalledWith('@tmp/jellyfin-playback-state-unknown.json');
  });

  it('keeps reading concurrent allowlisted states when one mailbox does not exist yet', () => {
    const file = fileApi({ [playbackStatePath(state.playbackId)]: JSON.stringify(state) });
    file.read.mockImplementation((path: string) => {
      if (path === playbackStatePath('play-pending')) throw new Error('File does not exist');
      return file.files.get(path);
    });

    expect(readPlaybackStates(file, new Set(['play-pending', state.playbackId]))).toEqual([state]);
  });

  it('rejects path traversal and prunes only exact unretained mailbox files', () => {
    expect(() => playbackStatePath('../token')).toThrow('Invalid public playback identifier');
    const retained = playbackStatePath(state.playbackId);
    const stale = playbackStatePath('play-stale');
    const file = fileApi({
      [retained]: JSON.stringify(state),
      [stale]: JSON.stringify({ ...state, playbackId: 'play-stale' }),
      '@tmp/unrelated-temporary-file': 'keep',
    });

    prunePlaybackStateFiles(file, new Set([state.playbackId]));

    expect(file.files.has(retained)).toBe(true);
    expect(file.files.has(stale)).toBe(false);
    expect(file.files.has('@tmp/unrelated-temporary-file')).toBe(true);
  });
});
