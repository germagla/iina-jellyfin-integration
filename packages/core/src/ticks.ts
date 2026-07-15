export const JELLYFIN_TICKS_PER_SECOND = 10_000_000;

function finiteNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a finite non-negative number`);
  return value;
}

function safeInteger(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new RangeError("The converted tick value exceeds JavaScript's safe range");
  return value;
}

export function secondsToTicks(seconds: number): number {
  return safeInteger(Math.round(finiteNonNegative(seconds, 'seconds') * JELLYFIN_TICKS_PER_SECOND));
}

export function millisecondsToTicks(milliseconds: number): number {
  return safeInteger(Math.round(finiteNonNegative(milliseconds, 'milliseconds') * 10_000));
}

export function ticksToSeconds(ticks: number): number {
  return finiteNonNegative(ticks, 'ticks') / JELLYFIN_TICKS_PER_SECOND;
}

export function clampPositionTicks(positionTicks: number, durationTicks?: number): number {
  const position = safeInteger(Math.round(finiteNonNegative(positionTicks, 'positionTicks')));
  if (durationTicks === undefined) return position;
  const duration = safeInteger(Math.round(finiteNonNegative(durationTicks, 'durationTicks')));
  return Math.min(position, duration);
}
