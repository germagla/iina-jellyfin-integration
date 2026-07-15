import { describe, expect, it } from 'vitest';

import type { ConnectionMetadata, PlaybackPlan } from '../src/contracts';
import {
  accessTokenAccount,
  ConnectionPersistence,
  CONNECTION_METADATA_PREFERENCE_KEY,
  type PreferenceStore,
  type SecretStore,
} from '../src/persistence';
import {
  beginPlaybackSession,
  createIdlePlaybackSession,
  reducePlaybackSession,
  shouldReportPeriodicProgress,
} from '../src/session';

const plan: PlaybackPlan = {
  itemId: 'movie-1',
  playSessionId: 'play-session-1',
  mediaSourceId: 'source-1',
  url: 'https://media.example/jellyfin/Videos/movie-1/stream',
  headers: {},
  playMethod: 'DirectPlay',
  conversion: 'none',
  requiresVideoTranscodeConfirmation: false,
  transcodeReasons: [],
  startPositionTicks: 0,
  runtimeTicks: 1_000_000_000,
};

describe('playback session state machine', () => {
  it('tracks valid transitions and ignores stale player callbacks', () => {
    const first = beginPlaybackSession(createIdlePlaybackSession(), plan);
    const replacement = beginPlaybackSession(first, {
      ...plan,
      itemId: 'movie-2',
      playSessionId: 'session-2',
    });

    const stale = reducePlaybackSession(replacement, {
      type: 'media-started',
      generation: first.generation,
      positionTicks: 99,
    });
    expect(stale).toBe(replacement);

    const playing = reducePlaybackSession(replacement, {
      type: 'media-started',
      generation: replacement.generation,
      positionTicks: 10,
    });
    expect(playing).toMatchObject({ status: 'playing', positionTicks: 10 });

    const paused = reducePlaybackSession(playing, {
      type: 'pause',
      generation: playing.generation,
      positionTicks: 20,
    });
    expect(paused.status).toBe('paused');

    const resumed = reducePlaybackSession(paused, {
      type: 'resume',
      generation: paused.generation,
      positionTicks: 21,
    });
    expect(resumed.status).toBe('playing');
  });

  it('requests periodic progress around ten seconds and records reports', () => {
    let state = beginPlaybackSession(createIdlePlaybackSession(), plan);
    state = reducePlaybackSession(state, { type: 'media-started', generation: state.generation });
    expect(shouldReportPeriodicProgress(state, 1_000)).toBe(true);

    state = reducePlaybackSession(state, {
      type: 'progress-reported',
      generation: state.generation,
      atMs: 1_000,
    });
    expect(shouldReportPeriodicProgress(state, 10_999)).toBe(false);
    expect(shouldReportPeriodicProgress(state, 11_000)).toBe(true);
  });
});

class MemoryPreferences implements PreferenceStore {
  readonly values = new Map<string, unknown>();
  get(key: string) {
    return this.values.get(key);
  }
  set(key: string, value: unknown) {
    this.values.set(key, value);
  }
  delete(key: string) {
    this.values.delete(key);
  }
}

class MemorySecrets implements SecretStore {
  readonly values = new Map<string, string>();
  get(account: string) {
    return this.values.get(account);
  }
  set(account: string, secret: string) {
    this.values.set(account, secret);
  }
  delete(account: string) {
    this.values.delete(account);
  }
}

const metadata: ConnectionMetadata = {
  schemaVersion: 1,
  serverUrl: 'https://media.example/jellyfin',
  serverId: 'server-1',
  serverName: 'Home',
  userId: 'user-1',
  username: 'viewer',
  deviceId: 'stable-device',
  acceptedInsecureRemote: false,
  lastConnectedAt: '2026-07-15T00:00:00.000Z',
};

describe('persistence boundaries', () => {
  it('stores only non-secret metadata in preferences and the token in the secret store', async () => {
    const preferences = new MemoryPreferences();
    const secrets = new MemorySecrets();
    const persistence = new ConnectionPersistence(preferences, secrets);

    await persistence.save(metadata, 'keychain-only-token');

    expect(preferences.values.get(CONNECTION_METADATA_PREFERENCE_KEY)).toEqual(metadata);
    expect(
      JSON.stringify(preferences.values.get(CONNECTION_METADATA_PREFERENCE_KEY)),
    ).not.toContain('keychain-only-token');
    expect(secrets.values.get(accessTokenAccount(metadata))).toBe('keychain-only-token');
    expect(await persistence.loadAuthenticated()).toEqual({
      metadata,
      accessToken: 'keychain-only-token',
    });
  });

  it('rejects accidental secret properties at the preferences boundary', async () => {
    const preferences = new MemoryPreferences();
    const secrets = new MemorySecrets();
    const persistence = new ConnectionPersistence(preferences, secrets);
    const unsafe = { ...metadata, password: 'must-not-persist' } as unknown as ConnectionMetadata;

    await expect(persistence.save(unsafe, 'token')).rejects.toThrow();
    expect(preferences.values.size).toBe(0);
    expect(secrets.values.size).toBe(0);
  });

  it('clears both stores', async () => {
    const preferences = new MemoryPreferences();
    const secrets = new MemorySecrets();
    const persistence = new ConnectionPersistence(preferences, secrets);
    await persistence.save(metadata, 'token');
    await persistence.clear();
    expect(preferences.values.size).toBe(0);
    expect(secrets.values.size).toBe(0);
  });
});
