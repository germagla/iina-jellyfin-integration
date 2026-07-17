import { DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY } from '@iina-jellyfin/core/preference-contracts';
import type { PreferenceApi } from './persistence';

export const DIAGNOSTIC_LOG_REVEAL_REQUEST_MAX_AGE_MS = 30_000;
const DIAGNOSTIC_LOG_REVEAL_REQUEST_FUTURE_TOLERANCE_MS = 5_000;

/** Consumes the preferences page's one-shot request to reveal the fixed diagnostic log path. */
export function consumeDiagnosticLogRevealRequest(
  preferences: PreferenceApi,
  now = Date.now(),
): boolean {
  const requestedAt = preferences.get(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY);
  if (
    requestedAt === undefined ||
    requestedAt === null ||
    requestedAt === '' ||
    requestedAt === 0
  ) {
    return false;
  }

  preferences.set(DIAGNOSTIC_LOG_REVEAL_REQUEST_PREFERENCE_KEY, 0);
  preferences.sync();

  return (
    typeof requestedAt === 'number' &&
    Number.isSafeInteger(requestedAt) &&
    requestedAt > 0 &&
    requestedAt <= now + DIAGNOSTIC_LOG_REVEAL_REQUEST_FUTURE_TOLERANCE_MS &&
    now - requestedAt <= DIAGNOSTIC_LOG_REVEAL_REQUEST_MAX_AGE_MS
  );
}
