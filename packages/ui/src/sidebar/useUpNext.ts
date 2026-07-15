import { useCallback, useEffect, useState } from 'react';
import type { PlayerUiHost, UpNextViewState } from './host';

export function useUpNext(host: PlayerUiHost) {
  const [upNext, setUpNext] = useState<UpNextViewState | undefined>(() => host.getUpNext());
  const [cancelled, setCancelled] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'started' | 'error'>('idle');
  const [error, setError] = useState<string>();

  useEffect(
    () =>
      host.subscribeUpNext((state) => {
        setUpNext(state);
        if (state !== undefined) {
          setCancelled(false);
          setStatus('idle');
          setError(undefined);
        }
      }),
    [host],
  );

  const playNow = useCallback(async () => {
    if (upNext === undefined || status === 'starting' || status === 'started') return;
    setStatus('starting');
    setError(undefined);
    try {
      await host.send('upNext.playNow');
      setStatus('started');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : 'The next episode could not start.');
    }
  }, [host, status, upNext]);

  const cancel = useCallback(async () => {
    if (upNext === undefined) return;
    setCancelled(true);
    setUpNext(undefined);
    setStatus('idle');
    try {
      await host.send('upNext.cancel');
    } catch {
      setCancelled(false);
      setUpNext(upNext);
      setError('The Up Next countdown could not be cancelled.');
    }
  }, [host, upNext]);

  const changeAutoplay = useCallback(
    (enabled: boolean) => {
      setUpNext((current) => (current === undefined ? current : { ...current, autoplay: enabled }));
      void host.send('settings.autoplay', { enabled }).catch(() => {
        setError('The autoplay setting could not be saved.');
      });
    },
    [host],
  );

  return { upNext, cancelled, status, error, playNow, cancel, changeAutoplay };
}
