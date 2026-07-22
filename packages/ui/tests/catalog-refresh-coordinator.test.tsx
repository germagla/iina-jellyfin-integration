import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogBridge, BridgeResultMap } from '../src/bridge/contracts';
import { useCatalogRefreshCoordinator } from '../src/catalog/useCatalogRefreshCoordinator';

const refreshResult: BridgeResultMap['catalog.refresh'] = {
  refreshedAt: '2026-07-16T12:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createBridge() {
  let invalidationListener: (() => void) | undefined;
  const unsubscribe = vi.fn(() => {
    invalidationListener = undefined;
  });
  const request = vi.fn(() => Promise.resolve(refreshResult));
  const bridge: CatalogBridge = {
    request: request as unknown as CatalogBridge['request'],
    subscribeInvalidation(listener) {
      invalidationListener = listener;
      return unsubscribe;
    },
  };

  return {
    bridge,
    request,
    unsubscribe,
    invalidate: () => invalidationListener?.(),
    currentInvalidationListener: () => invalidationListener,
  };
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

function RefreshHarness({
  bridge,
  enabled = true,
  onRefresh,
}: {
  bridge: CatalogBridge;
  enabled?: boolean;
  onRefresh: () => void;
}) {
  useCatalogRefreshCoordinator({ bridge, enabled, onRefresh });
  return null;
}

describe('useCatalogRefreshCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('coalesces foreground refresh bursts for 250 milliseconds', async () => {
    const bridge = createBridge();
    const onRefresh = vi.fn();
    render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);

    act(() => {
      bridge.invalidate();
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(249);
    });
    expect(bridge.request).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(bridge.request).toHaveBeenCalledTimes(1);
    expect(bridge.request).toHaveBeenCalledWith('catalog.refresh', {});
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('defers hidden refreshes until the document becomes visible', async () => {
    const bridge = createBridge();
    const onRefresh = vi.fn();
    setVisibility('hidden');
    render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);

    act(() => {
      bridge.invalidate();
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(90_000);
    });
    expect(bridge.request).not.toHaveBeenCalled();

    act(() => {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(249);
    });
    expect(bridge.request).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(bridge.request).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('queues at most one follow-up while a refresh is in flight', async () => {
    const bridge = createBridge();
    const firstRefresh = deferred<BridgeResultMap['catalog.refresh']>();
    bridge.request.mockImplementationOnce(() => firstRefresh.promise);
    const onRefresh = vi.fn();
    render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);

    await act(async () => {
      bridge.invalidate();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(bridge.request).toHaveBeenCalledTimes(1);

    act(() => {
      bridge.invalidate();
      bridge.invalidate();
      window.dispatchEvent(new Event('focus'));
    });

    await act(async () => {
      firstRefresh.resolve(refreshResult);
      await Promise.resolve();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(249));
    expect(bridge.request).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(bridge.request).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('continues screen revalidation after a coordinator probe failure', async () => {
    const bridge = createBridge();
    bridge.request.mockRejectedValueOnce(new Error('offline'));
    const onRefresh = vi.fn();
    render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);

    await act(async () => {
      bridge.invalidate();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(bridge.request).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      bridge.invalidate();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(bridge.request).toHaveBeenCalledTimes(2);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('does not refresh solely because time passes', async () => {
    const bridge = createBridge();
    const onRefresh = vi.fn();
    render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(bridge.request).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('uses the latest callback without restarting the coordinator', async () => {
    const bridge = createBridge();
    const firstCallback = vi.fn();
    const latestCallback = vi.fn();
    const view = render(<RefreshHarness bridge={bridge.bridge} onRefresh={firstCallback} />);

    act(() => bridge.invalidate());
    view.rerender(<RefreshHarness bridge={bridge.bridge} onRefresh={latestCallback} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
    expect(bridge.unsubscribe).not.toHaveBeenCalled();
  });

  it('cleans up timers, listeners, subscriptions, and in-flight completion', async () => {
    const bridge = createBridge();
    const refresh = deferred<BridgeResultMap['catalog.refresh']>();
    bridge.request.mockImplementationOnce(() => refresh.promise);
    const onRefresh = vi.fn();
    const view = render(<RefreshHarness bridge={bridge.bridge} onRefresh={onRefresh} />);
    const staleInvalidationListener = bridge.currentInvalidationListener();

    await act(async () => {
      bridge.invalidate();
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(bridge.request).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(bridge.unsubscribe).toHaveBeenCalledTimes(1);

    await act(async () => {
      staleInvalidationListener?.();
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(120_000);
      refresh.resolve(refreshResult);
      await Promise.resolve();
    });

    expect(bridge.request).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
