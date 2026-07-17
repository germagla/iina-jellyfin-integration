import { DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY } from '@iina-jellyfin/core/preference-contracts';
import { describe, expect, it } from 'vitest';
import { consumeDiagnosticLogRevealRequest } from '../src/diagnostic-log-request';
import type { PreferenceApi } from '../src/persistence';

function createPreferences(initial?: unknown) {
  const values = new Map<string, unknown>();
  if (initial !== undefined) values.set(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY, initial);
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

describe('consumeDiagnosticLogRevealRequest', () => {
  const now = 1_800_000_000_000;

  it('consumes one fresh request exactly once', () => {
    const harness = createPreferences(now - 500);

    expect(consumeDiagnosticLogRevealRequest(harness.preferences, now)).toBe(true);
    expect(consumeDiagnosticLogRevealRequest(harness.preferences, now)).toBe(false);
    expect(harness.values.get(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY)).toBe(0);
    expect(harness.syncCount()).toBe(1);
  });

  it.each([now - 30_001, now + 5_001, 'not-a-timestamp', Number.NaN])(
    'clears an invalid or stale request without revealing (%s)',
    (requestedAt) => {
      const harness = createPreferences(requestedAt);

      expect(consumeDiagnosticLogRevealRequest(harness.preferences, now)).toBe(false);
      expect(harness.values.get(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY)).toBe(0);
      expect(harness.syncCount()).toBe(1);
    },
  );
});
