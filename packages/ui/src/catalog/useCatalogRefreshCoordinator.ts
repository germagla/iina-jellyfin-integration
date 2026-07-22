import { useEffect, useRef } from 'react';
import type { CatalogBridge } from '../bridge/contracts';

const REFRESH_COALESCE_MS = 250;

export interface CatalogRefreshCoordinatorOptions {
  bridge: CatalogBridge;
  enabled: boolean;
  onRefresh: () => void;
}

/**
 * Coordinates all foreground catalog refresh triggers without tying their
 * lifetime to the active catalog route.
 */
export function useCatalogRefreshCoordinator({
  bridge,
  enabled,
  onRefresh,
}: CatalogRefreshCoordinatorOptions): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let refreshInFlight = false;
    let followUpQueued = false;
    let coalesceTimer: number | undefined;

    const clearCoalesceTimer = () => {
      if (coalesceTimer === undefined) return;
      window.clearTimeout(coalesceTimer);
      coalesceTimer = undefined;
    };

    const schedule = () => {
      if (disposed) return;

      if (document.visibilityState === 'hidden') {
        clearCoalesceTimer();
        return;
      }

      if (refreshInFlight) {
        followUpQueued = true;
        return;
      }

      clearCoalesceTimer();
      coalesceTimer = window.setTimeout(() => {
        coalesceTimer = undefined;
        if (disposed) return;
        if (document.visibilityState === 'hidden') {
          return;
        }

        refreshInFlight = true;
        void bridge
          .request('catalog.refresh', {})
          .then(() => {
            if (!disposed) onRefreshRef.current();
          })
          .catch(() => {
            // A failed coordinator probe should not suppress the visible screen's
            // own revalidation and recoverable stale-content error state.
            if (!disposed) onRefreshRef.current();
          })
          .finally(() => {
            if (disposed) return;
            refreshInFlight = false;
            if (!followUpQueued) return;
            followUpQueued = false;
            schedule();
          });
      }, REFRESH_COALESCE_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearCoalesceTimer();
        return;
      }
      schedule();
    };

    const unsubscribeInvalidation = bridge.subscribeInvalidation?.(schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      clearCoalesceTimer();
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribeInvalidation?.();
    };
  }, [bridge, enabled]);
}
