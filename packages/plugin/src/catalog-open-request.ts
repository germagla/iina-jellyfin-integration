import { CATALOG_OPEN_REQUEST_PREFERENCE_KEY } from '@iina-jellyfin/core/preference-contracts';
import type { PreferenceApi } from './persistence';

export const CATALOG_OPEN_REQUEST_MAX_AGE_MS = 30_000;
const CATALOG_OPEN_REQUEST_FUTURE_TOLERANCE_MS = 5_000;

/**
 * Consumes the one-shot request written by IINA's isolated plugin preferences
 * page. Invalid and stale values are cleared without opening the catalog.
 */
export function consumeCatalogOpenRequest(preferences: PreferenceApi, now = Date.now()): boolean {
  const requestedAt = preferences.get(CATALOG_OPEN_REQUEST_PREFERENCE_KEY);
  if (
    requestedAt === undefined ||
    requestedAt === null ||
    requestedAt === '' ||
    requestedAt === 0
  ) {
    return false;
  }

  preferences.set(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, 0);
  preferences.sync();

  return (
    typeof requestedAt === 'number' &&
    Number.isSafeInteger(requestedAt) &&
    requestedAt > 0 &&
    requestedAt <= now + CATALOG_OPEN_REQUEST_FUTURE_TOLERANCE_MS &&
    now - requestedAt <= CATALOG_OPEN_REQUEST_MAX_AGE_MS
  );
}
