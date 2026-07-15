import { describe, expect, it } from 'vitest';
import { ConnectionStore, keychainAccount } from '../src/persistence';

function createHarness(
  options: { rejectWrite?: (name: string, password: string) => boolean } = {},
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
        sync: () => undefined,
      },
      {
        keyChainRead: (service, name) => secrets.get(`${service}:${name}`) ?? false,
        keyChainWrite: (service, name, password) => {
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

  it('uses stable, account-specific keychain names', () => {
    expect(keychainAccount(metadata)).toBe('server-1:user-1');
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

  it('does not switch accounts when the previous Keychain token cannot be erased', () => {
    const previousAccount = keychainAccount(metadata);
    const { store } = createHarness({
      rejectWrite: (name, password) => name === previousAccount && password === '',
    });
    store.save(metadata, 'first-token');
    const nextMetadata = {
      ...metadata,
      userId: 'user-2',
      username: 'second-viewer',
    };

    expect(() => store.save(nextMetadata, 'second-token')).toThrow('did not remove');
    expect(store.readMetadata()).toEqual(metadata);
    expect(store.readAccessToken(metadata)).toBe('first-token');
    expect(store.readAccessToken(nextMetadata)).toBeUndefined();
  });
});
