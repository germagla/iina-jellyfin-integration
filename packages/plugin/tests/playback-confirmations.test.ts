import type { PlaybackRequest } from '@iina-jellyfin/core';
import { describe, expect, it } from 'vitest';
import { PlaybackConfirmationStore } from '../src/playback-confirmations';

function request(overrides: Partial<PlaybackRequest> = {}): PlaybackRequest {
  return {
    itemId: 'episode-1',
    startPositionTicks: 0,
    maxStreamingBitrate: 120_000_000,
    openInNewWindow: false,
    ...overrides,
  };
}

describe('PlaybackConfirmationStore', () => {
  it('returns the exact stored launch once for a matching request and generation', () => {
    const store = new PlaybackConfirmationStore(
      () => 1_000,
      () => 'permit-1',
    );
    const launch = { nonce: 'launch-1' };
    const id = store.issue(request(), launch, {
      connectionGeneration: 3,
      managedSequence: 7,
    });

    expect(store.consume(id, request(), { connectionGeneration: 3, managedSequence: 7 })).toEqual({
      value: launch,
      managedSequence: 7,
    });
    expect(
      store.consume(id, request(), { connectionGeneration: 3, managedSequence: 7 }),
    ).toBeUndefined();
  });

  it.each([
    ['item', { itemId: 'episode-2' }],
    ['resume position', { startPositionTicks: 50_000_000 }],
    ['version', { mediaSourceId: 'source-2' }],
    ['audio track', { audioStreamIndex: 4 }],
    ['subtitle track', { subtitleStreamIndex: 8 }],
    ['window mode', { openInNewWindow: true }],
    ['bitrate', { maxStreamingBitrate: 8_000_000 }],
  ] satisfies [string, Partial<PlaybackRequest>][])('rejects a changed %s', (_label, change) => {
    let idSequence = 0;
    const store = new PlaybackConfirmationStore(
      () => 1_000,
      () => `permit-${++idSequence}`,
    );
    const id = store.issue(request(), 'launch', {
      connectionGeneration: 3,
      managedSequence: 7,
    });

    expect(
      store.consume(id, request(change), { connectionGeneration: 3, managedSequence: 7 }),
    ).toBeUndefined();
  });

  it('rejects stale connection and managed-player generations', () => {
    let idSequence = 0;
    const store = new PlaybackConfirmationStore(
      () => 1_000,
      () => `permit-${++idSequence}`,
    );
    const connectionPermit = store.issue(request(), 'first', {
      connectionGeneration: 3,
      managedSequence: 7,
    });
    const playerPermit = store.issue(request(), 'second', {
      connectionGeneration: 3,
      managedSequence: 7,
    });

    expect(
      store.consume(connectionPermit, request(), {
        connectionGeneration: 4,
        managedSequence: 7,
      }),
    ).toBeUndefined();
    expect(
      store.consume(playerPermit, request(), {
        connectionGeneration: 3,
        managedSequence: 8,
      }),
    ).toBeUndefined();
  });

  it('expires permits and clears all pending launches', () => {
    let now = 1_000;
    let idSequence = 0;
    const store = new PlaybackConfirmationStore(
      () => now,
      () => `permit-${++idSequence}`,
      100,
    );
    const expired = store.issue(request(), 'expired', {
      connectionGeneration: 3,
      managedSequence: 7,
    });
    now = 1_100;
    expect(
      store.consume(expired, request(), { connectionGeneration: 3, managedSequence: 7 }),
    ).toBeUndefined();

    const cleared = store.issue(request(), 'cleared', {
      connectionGeneration: 3,
      managedSequence: 7,
    });
    store.clear();
    expect(
      store.consume(cleared, request(), { connectionGeneration: 3, managedSequence: 7 }),
    ).toBeUndefined();
  });

  it('bounds abandoned confirmations', () => {
    let idSequence = 0;
    const store = new PlaybackConfirmationStore(
      () => 1_000,
      () => `permit-${++idSequence}`,
      1_000,
      2,
    );
    const first = store.issue(request({ itemId: 'one' }), 'one', {
      connectionGeneration: 1,
    });
    const second = store.issue(request({ itemId: 'two' }), 'two', {
      connectionGeneration: 1,
    });
    const third = store.issue(request({ itemId: 'three' }), 'three', {
      connectionGeneration: 1,
    });

    expect(
      store.consume(first, request({ itemId: 'one' }), {
        connectionGeneration: 1,
        managedSequence: 0,
      }),
    ).toBeUndefined();
    expect(
      store.consume(second, request({ itemId: 'two' }), {
        connectionGeneration: 1,
        managedSequence: 0,
      })?.value,
    ).toBe('two');
    expect(
      store.consume(third, request({ itemId: 'three' }), {
        connectionGeneration: 1,
        managedSequence: 0,
      })?.value,
    ).toBe('three');
  });
});
