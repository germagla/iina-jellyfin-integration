import { describe, expect, it } from 'vitest';
import {
  parsePublicPlaybackState,
  parsePublicPlaybackStateRemoval,
  serializePublicPlaybackState,
  type PublicPlaybackState,
} from '../src/playback-state';

const state: PublicPlaybackState = {
  version: 1,
  playbackId: 'play-1',
  sequence: 4,
  generation: 2,
  status: 'playing',
  itemId: 'episode-3',
  positionTicks: 120_000_000,
  durationTicks: 600_000_000,
  playbackRate: 1.5,
  isBuffering: false,
  title: 'The Episode',
  seriesName: 'The Series',
  seasonNumber: 2,
  episodeNumber: 3,
  playMethod: 'DirectPlay',
  startedAtMs: 1_699_999_999_000,
  updatedAtMs: 1_700_000_000_000,
};

describe('public playback state', () => {
  it('round-trips the bounded secret-free snapshot used by the catalog', () => {
    expect(parsePublicPlaybackState(serializePublicPlaybackState(state))).toEqual(state);
    expect(parsePublicPlaybackState(state)).toEqual(state);
  });

  it('rejects malformed, oversized, and secret-shaped additions', () => {
    expect(parsePublicPlaybackState('{not-json')).toBeUndefined();
    expect(parsePublicPlaybackState('x'.repeat(8_193))).toBeUndefined();
    expect(parsePublicPlaybackState({ ...state, accessToken: 'must-not-cross' })).toBeUndefined();
    expect(parsePublicPlaybackState({ ...state, positionTicks: -1 })).toBeUndefined();
    expect(parsePublicPlaybackState({ ...state, playbackRate: 0 })).toBeUndefined();
  });

  it('strictly validates revisioned removal tombstones', () => {
    const removal = {
      version: 1 as const,
      playbackId: state.playbackId,
      generation: state.generation,
      sequence: state.sequence,
      removedAtMs: state.updatedAtMs + 1,
    };
    expect(parsePublicPlaybackStateRemoval(removal)).toEqual(removal);
    expect(parsePublicPlaybackStateRemoval({ ...removal, accessToken: 'no' })).toBeUndefined();
    expect(parsePublicPlaybackStateRemoval({ playbackId: state.playbackId })).toBeUndefined();
  });
});
