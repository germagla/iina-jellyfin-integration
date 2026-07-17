import { describe, expect, it } from 'vitest';
import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE } from '../src/constants';
import { ConnectionStore } from '../src/persistence';

function createHarness(
  options: {
    rejectWrite?: (name: string, password: string) => boolean;
    sync?: () => void;
  } = {},
) {
  const preferences = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  return {
    preferences,
    secrets,
    store: new ConnectionStore(
      {
        get: (key) => preferences.get(key),
        set: (key, value) => preferences.set(key, value),
        sync: options.sync ?? (() => undefined),
      },
      {
        read: (service, name) => secrets.get(`${service}:${name}`) ?? false,
        write: (service, name, password) => {
          if (options.rejectWrite?.(name, password) === true) return false;
          secrets.set(`${service}:${name}`, password);
          return true;
        },
      },
    ),
  };
}

const metadata = {
  schemaVersion: 1 as const,
  serverUrl: 'https://media.example.test/jellyfin',
  serverId: 'server-1',
  serverName: 'Home',
  userId: 'user-1',
  username: 'viewer',
  deviceId: 'device-1234567890',
  acceptedInsecureRemote: false,
  lastConnectedAt: '2026-07-15T00:00:00.000Z',
};

describe('ConnectionStore', () => {
  it('separates access tokens from non-secret preferences', () => {
    const { preferences, secrets, store } = createHarness();
    store.save(metadata, 'top-secret-token');

    expect(JSON.stringify([...preferences])).not.toContain('top-secret-token');
    expect(JSON.stringify([...secrets])).toContain('top-secret-token');
    expect(store.readAccessToken(metadata)).toBe('top-secret-token');
  });

  it('uses one stable Keychain item for the single V1 connection', () => {
    const { secrets, store } = createHarness();
    store.save(metadata, 'top-secret-token');

    expect([...secrets.keys()]).toEqual([`${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`]);
  });

  it('will not release a token when preference metadata is redirected to another URL', () => {
    const { store } = createHarness();
    store.save(metadata, 'top-secret-token');

    expect(
      store.readAccessToken({ ...metadata, serverUrl: 'https://attacker.example.test/jellyfin' }),
    ).toBeUndefined();
  });

  it('overwrites the keychain value when disconnecting', () => {
    const { store } = createHarness();
    store.save(metadata, 'top-secret-token');
    store.clear();
    expect(store.readMetadata()).toBeUndefined();
    expect(store.readAccessToken(metadata)).toBeUndefined();
  });

  it('retains connection metadata when Keychain refuses to erase a token', () => {
    const { store } = createHarness({ rejectWrite: (_name, password) => password === '' });
    store.save(metadata, 'top-secret-token');

    expect(() => store.clear()).toThrow('did not remove');
    expect(store.readMetadata()).toEqual(metadata);
    expect(store.readAccessToken(metadata)).toBe('top-secret-token');
  });

  it('replaces the active connection atomically', () => {
    const { store } = createHarness();
    store.save(metadata, 'first-token');
    const nextMetadata = {
      ...metadata,
      userId: 'user-2',
      username: 'second-viewer',
    };

    store.save(nextMetadata, 'second-token');

    expect(store.readMetadata()).toEqual(nextMetadata);
    expect(store.readAccessToken(metadata)).toBeUndefined();
    expect(store.readAccessToken(nextMetadata)).toBe('second-token');
  });

  it('keeps the previous connection when Keychain refuses a replacement token', () => {
    let rejectReplacement = false;
    const { store } = createHarness({
      rejectWrite: (_name, password) => rejectReplacement && password.includes('second-token'),
    });
    store.save(metadata, 'first-token');
    const nextMetadata = {
      ...metadata,
      userId: 'user-2',
      username: 'second-viewer',
    };
    rejectReplacement = true;

    expect(() => store.save(nextMetadata, 'second-token')).toThrow('did not accept');
    expect(store.readMetadata()).toEqual(metadata);
    expect(store.readAccessToken(metadata)).toBe('first-token');
    expect(store.readAccessToken(nextMetadata)).toBeUndefined();
  });

  it('clears the fixed Keychain item even when metadata is missing', () => {
    const { secrets, store } = createHarness();
    secrets.set(`${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`, 'orphaned-token');

    store.clear();

    expect(secrets.get(`${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}`)).toBe('');
  });

  it('restores preferences and reports when a Keychain rollback fails', () => {
    let syncCalls = 0;
    let rejectRollback = false;
    const { store } = createHarness({
      rejectWrite: (_name, password) => rejectRollback && password.includes('first-token'),
      sync: () => {
        syncCalls += 1;
        if (syncCalls === 2) throw new Error('preference sync failed');
      },
    });
    store.save(metadata, 'first-token');
    rejectRollback = true;
    const nextMetadata = {
      ...metadata,
      userId: 'user-2',
      username: 'second-viewer',
    };

    expect(() => store.save(nextMetadata, 'second-token')).toThrow('restored safely');
    expect(store.readMetadata()).toEqual(metadata);
  });
});
