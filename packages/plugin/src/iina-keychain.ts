import type { KeychainApi } from './persistence';

type KeychainRead = (service: string, name: string) => string | false;
type KeychainWrite = (service: string, name: string, password: string) => boolean;

interface IinaKeychainSurface {
  // IINA 1.4.x exposes these spellings at runtime.
  keychainRead?: KeychainRead;
  keychainWrite?: KeychainWrite;
  // The published IINA TypeScript definitions currently use these spellings.
  keyChainRead?: KeychainRead;
  keyChainWrite?: KeychainWrite;
}

const KEYCHAIN_UNAVAILABLE_MESSAGE =
  "IINA's secure Keychain API is unavailable. Restart or update IINA, then try again.";
const KEYCHAIN_OPERATION_FAILED_MESSAGE =
  'macOS Keychain could not complete the secure storage operation.';

/**
 * Isolates a naming mismatch between IINA's runtime and its published typings.
 * Keep calls bound to the original JSExport object because bridged methods may
 * depend on their receiver.
 */
export function createIinaKeychainApi(utils: unknown): KeychainApi {
  const surface = utils as IinaKeychainSurface;
  const read = surface.keychainRead ?? surface.keyChainRead;
  const write = surface.keychainWrite ?? surface.keyChainWrite;

  return {
    read(service, name) {
      if (typeof read !== 'function') throw new Error(KEYCHAIN_UNAVAILABLE_MESSAGE);
      try {
        return read.call(utils, service, name);
      } catch {
        throw new Error(KEYCHAIN_OPERATION_FAILED_MESSAGE);
      }
    },
    write(service, name, password) {
      if (typeof write !== 'function') throw new Error(KEYCHAIN_UNAVAILABLE_MESSAGE);
      try {
        return write.call(utils, service, name, password);
      } catch {
        throw new Error(KEYCHAIN_OPERATION_FAILED_MESSAGE);
      }
    },
  };
}
