import { describe, expect, it, vi } from 'vitest';
import { createIinaKeychainApi } from '../src/iina-keychain';

describe('createIinaKeychainApi', () => {
  it('uses the lowercase-c methods exported by IINA 1.4.4', () => {
    const utils = {
      keychainRead: vi.fn(() => 'stored-token'),
      keychainWrite: vi.fn(() => true),
    };
    const keychain = createIinaKeychainApi(utils);

    expect(keychain.read('jellyfin', 'account')).toBe('stored-token');
    expect(keychain.write('jellyfin', 'account', 'new-token')).toBe(true);
    expect(utils.keychainRead).toHaveBeenCalledWith('jellyfin', 'account');
    expect(utils.keychainWrite).toHaveBeenCalledWith('jellyfin', 'account', 'new-token');
  });

  it('falls back to the spellings in IINA published typings', () => {
    const utils = {
      keyChainRead: vi.fn(() => false as const),
      keyChainWrite: vi.fn(() => true),
    };
    const keychain = createIinaKeychainApi(utils);

    expect(keychain.read('jellyfin', 'account')).toBe(false);
    expect(keychain.write('jellyfin', 'account', 'new-token')).toBe(true);
  });

  it('preserves the bridged method receiver', () => {
    const utils = {
      marker: 'iina-utils',
      keychainRead(this: { marker: string }) {
        return this.marker;
      },
      keychainWrite(this: { marker: string }) {
        return this.marker === 'iina-utils';
      },
    };
    const keychain = createIinaKeychainApi(utils);

    expect(keychain.read('jellyfin', 'account')).toBe('iina-utils');
    expect(keychain.write('jellyfin', 'account', 'new-token')).toBe(true);
  });

  it('reports a useful error when secure storage is unavailable', () => {
    const keychain = createIinaKeychainApi({});

    expect(() => keychain.read('jellyfin', 'account')).toThrow('secure Keychain API');
    expect(() => keychain.write('jellyfin', 'account', 'new-token')).toThrow('secure Keychain API');
  });

  it('does not expose native bridge arguments when a Keychain call throws', () => {
    const utils = {
      keychainRead: () => {
        throw new Error('native invocation included secret-token');
      },
      keychainWrite: () => {
        throw new Error('native invocation included secret-token');
      },
    };
    const keychain = createIinaKeychainApi(utils);

    for (const operation of [
      () => keychain.read('jellyfin', 'account'),
      () => keychain.write('jellyfin', 'account', 'secret-token'),
    ]) {
      try {
        operation();
      } catch (error) {
        expect(error).toHaveProperty(
          'message',
          'macOS Keychain could not complete the secure storage operation.',
        );
        expect(error).not.toHaveProperty('message', expect.stringContaining('secret-token'));
      }
    }
  });
});
