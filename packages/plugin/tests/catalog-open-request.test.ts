import { CATALOG_OPEN_REQUEST_PREFERENCE_KEY } from '@iina-jellyfin/core/preference-contracts';
import { describe, expect, it } from 'vitest';
import { consumeCatalogOpenRequest } from '../src/catalog-open-request';
import type { PreferenceApi } from '../src/persistence';

function createPreferences(initial?: unknown) {
  const values = new Map<string, unknown>();
  if (initial !== undefined) values.set(CATALOG_OPEN_REQUEST_PREFERENCE_KEY, initial);
  let syncCount = 0;
  const preferences: PreferenceApi = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    sync: () => {
      syncCount += 1;
    },
  };
  return { preferences, values, syncCount: () => syncCount };
}

describe('consumeCatalogOpenRequest', () => {
  const now = 1_800_000_000_000;

  it('consumes one recent request exactly once', () => {
    const harness = createPreferences(now - 500);

    expect(consumeCatalogOpenRequest(harness.preferences, now)).toBe(true);
    expect(consumeCatalogOpenRequest(harness.preferences, now)).toBe(false);
    expect(harness.values.get(CATALOG_OPEN_REQUEST_PREFERENCE_KEY)).toBe(0);
    expect(harness.syncCount()).toBe(1);
  });

  it.each([now - 30_001, now + 5_001, 'not-a-timestamp', Number.NaN])(
    'clears an invalid or stale request without opening (%s)',
    (requestedAt) => {
      const harness = createPreferences(requestedAt);

      expect(consumeCatalogOpenRequest(harness.preferences, now)).toBe(false);
      expect(harness.values.get(CATALOG_OPEN_REQUEST_PREFERENCE_KEY)).toBe(0);
      expect(harness.syncCount()).toBe(1);
    },
  );

  it('does not write when there is no pending request', () => {
    const harness = createPreferences(0);

    expect(consumeCatalogOpenRequest(harness.preferences, now)).toBe(false);
    expect(harness.syncCount()).toBe(0);
  });
});
