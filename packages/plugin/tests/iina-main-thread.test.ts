import { describe, expect, it, vi } from 'vitest';
import {
  createPlayerInstanceOnMainThread,
  runOnIinaMainThread,
  type IinaMainThreadScheduler,
} from '../src/iina-main-thread';

function controlledScheduler() {
  let callback: (() => void) | undefined;
  const schedule = vi.fn<IinaMainThreadScheduler>((next, delayMs) => {
    expect(delayMs).toBe(0);
    callback = next;
    return 'timer-1';
  });
  return {
    schedule,
    run: () => {
      if (callback === undefined) throw new Error('No main-thread callback was scheduled');
      callback();
    },
  };
}

describe('createPlayerInstanceOnMainThread', () => {
  it('creates the player only from inside the scheduled callback', async () => {
    const scheduler = controlledScheduler();
    let insideScheduledCallback = false;
    const createPlayerInstance = vi.fn(() => {
      expect(insideScheduledCallback).toBe(true);
      return 42;
    });

    const result = createPlayerInstanceOnMainThread(createPlayerInstance, scheduler.schedule);

    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(createPlayerInstance).not.toHaveBeenCalled();
    insideScheduledCallback = true;
    scheduler.run();
    insideScheduledCallback = false;

    await expect(result).resolves.toBe(42);
    expect(createPlayerInstance).toHaveBeenCalledTimes(1);
  });

  it('rejects when validation or native player creation throws', async () => {
    const scheduler = controlledScheduler();
    const failure = new Error('stale playback request');
    const result = createPlayerInstanceOnMainThread(() => {
      throw failure;
    }, scheduler.schedule);

    scheduler.run();

    await expect(result).rejects.toBe(failure);
  });

  it('runs arbitrary native operations only inside the scheduled callback', async () => {
    const scheduler = controlledScheduler();
    let insideScheduledCallback = false;
    const operation = vi.fn(() => {
      expect(insideScheduledCallback).toBe(true);
      return 'delivered';
    });

    const result = runOnIinaMainThread(operation, scheduler.schedule);
    expect(operation).not.toHaveBeenCalled();
    insideScheduledCallback = true;
    scheduler.run();
    insideScheduledCallback = false;

    await expect(result).resolves.toBe('delivered');
  });
});
