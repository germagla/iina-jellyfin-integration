export type IinaMainThreadScheduler = (callback: () => void, delayMs: number) => unknown;

/**
 * IINA's HTTP promises settle on their URL-session delegate queue, while creating a
 * player instance opens AppKit windows synchronously. IINA's timer polyfill moves
 * callbacks onto the main run loop, so the native call must happen inside the
 * scheduled callback rather than after merely awaiting a delay.
 */
export function runOnIinaMainThread<Value>(
  operation: () => Value,
  schedule: IinaMainThreadScheduler = setTimeout,
): Promise<Value> {
  return new Promise((resolve, reject) => {
    schedule(() => {
      try {
        resolve(operation());
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
}

export function createPlayerInstanceOnMainThread(
  createPlayerInstance: () => number,
  schedule: IinaMainThreadScheduler = setTimeout,
): Promise<number> {
  return runOnIinaMainThread(createPlayerInstance, schedule);
}
