import type { PlaybackPlan, PlaybackSessionState } from './contracts';
import { clampPositionTicks } from './ticks';

export type PlaybackSessionEvent =
  | {
      type: 'media-started';
      generation: number;
      positionTicks?: number | undefined;
      durationTicks?: number | undefined;
    }
  | { type: 'pause'; generation: number; positionTicks: number }
  | { type: 'resume'; generation: number; positionTicks: number }
  | { type: 'seek'; generation: number; positionTicks: number }
  | {
      type: 'time-update';
      generation: number;
      positionTicks: number;
      durationTicks?: number | undefined;
    }
  | { type: 'progress-reported'; generation: number; atMs: number }
  | {
      type: 'stop';
      generation: number;
      positionTicks: number;
      reason: 'closed' | 'replaced' | 'user';
    }
  | { type: 'complete'; generation: number; positionTicks: number }
  | { type: 'fail'; generation: number; positionTicks: number; message: string };

export function createIdlePlaybackSession(): PlaybackSessionState {
  return {
    generation: 0,
    status: 'idle',
    positionTicks: 0,
  };
}

/** Starting a plan increments the generation, invalidating all old player callbacks. */
export function beginPlaybackSession(
  state: PlaybackSessionState,
  plan: PlaybackPlan,
): PlaybackSessionState {
  const next: PlaybackSessionState = {
    generation: state.generation + 1,
    status: 'preparing',
    plan,
    positionTicks: plan.startPositionTicks,
  };
  if (plan.runtimeTicks !== undefined) next.durationTicks = plan.runtimeTicks;
  return next;
}

function active(state: PlaybackSessionState): boolean {
  return state.status === 'preparing' || state.status === 'playing' || state.status === 'paused';
}

function position(state: PlaybackSessionState, value: number): number {
  return clampPositionTicks(value, state.durationTicks);
}

export function reducePlaybackSession(
  state: PlaybackSessionState,
  event: PlaybackSessionEvent,
): PlaybackSessionState {
  if (event.generation !== state.generation || state.plan === undefined) return state;

  switch (event.type) {
    case 'media-started': {
      if (state.status !== 'preparing') return state;
      const next: PlaybackSessionState = {
        ...state,
        status: 'playing',
        positionTicks: position(state, event.positionTicks ?? state.positionTicks),
      };
      if (event.durationTicks !== undefined) {
        next.durationTicks = event.durationTicks;
        next.positionTicks = clampPositionTicks(next.positionTicks, event.durationTicks);
      }
      return next;
    }
    case 'pause':
      return state.status === 'playing'
        ? { ...state, status: 'paused', positionTicks: position(state, event.positionTicks) }
        : state;
    case 'resume':
      return state.status === 'paused'
        ? { ...state, status: 'playing', positionTicks: position(state, event.positionTicks) }
        : state;
    case 'seek':
      return active(state)
        ? { ...state, positionTicks: position(state, event.positionTicks) }
        : state;
    case 'time-update': {
      if (!active(state)) return state;
      const next = { ...state, positionTicks: position(state, event.positionTicks) };
      if (event.durationTicks !== undefined) {
        next.durationTicks = event.durationTicks;
        next.positionTicks = clampPositionTicks(event.positionTicks, event.durationTicks);
      }
      return next;
    }
    case 'progress-reported':
      return active(state) ? { ...state, lastProgressReportAtMs: event.atMs } : state;
    case 'stop':
      return active(state)
        ? {
            ...state,
            status: 'stopped',
            positionTicks: position(state, event.positionTicks),
            stopReason: event.reason,
          }
        : state;
    case 'complete':
      return active(state)
        ? {
            ...state,
            status: 'stopped',
            positionTicks: position(state, event.positionTicks),
            stopReason: 'completed',
          }
        : state;
    case 'fail':
      return active(state)
        ? {
            ...state,
            status: 'error',
            positionTicks: position(state, event.positionTicks),
            stopReason: 'failed',
            errorMessage: event.message.slice(0, 2_000),
          }
        : state;
  }
}

export function shouldReportPeriodicProgress(
  state: PlaybackSessionState,
  nowMs: number,
  intervalMs = 10_000,
): boolean {
  if (state.status !== 'playing' || state.plan === undefined) return false;
  if (!Number.isFinite(nowMs) || nowMs < 0) return false;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0)
    throw new RangeError('intervalMs must be positive');
  return (
    state.lastProgressReportAtMs === undefined || nowMs - state.lastProgressReportAtMs >= intervalMs
  );
}
