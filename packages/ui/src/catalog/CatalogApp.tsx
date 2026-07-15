import { SpinnerGap } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import type {
  CatalogBridge,
  EpisodeDetails,
  MediaCard,
  PlaybackConfirmationNotice,
  ShowDetails,
} from '../bridge/contracts';
import { createCatalogBridge } from '../bridge/client';
import {
  episodesFromResult,
  isItemsResult,
  seasonsFromEpisodes,
  showDetailsFromResult,
} from '../bridge/adapters';
import { AppChrome, type CatalogRoute } from './Chrome';
import { ConnectionScreen } from './ConnectionScreen';
import { DetailsScreen } from './DetailsScreen';
import { GridScreen, HomeScreen, SearchScreen } from './LibraryScreens';
import { type DemoSurfaceState, ErrorState } from './SurfaceState';
import './catalog.css';

export interface CatalogAppProps {
  bridge?: CatalogBridge;
  initialConnected?: boolean;
  initialRoute?: CatalogRoute;
  demoState?: DemoSurfaceState;
  showOverride?: ShowDetails;
}

function DetailsLoader({
  bridge,
  itemId,
  demoState,
  refreshKey,
  showOverride,
  playbackConfirmation,
  onConfirmationPresented,
  onNavigate,
  onDisconnect,
}: {
  bridge: CatalogBridge;
  itemId: string;
  demoState: DemoSurfaceState;
  refreshKey: number;
  showOverride?: ShowDetails;
  playbackConfirmation?: PlaybackConfirmationNotice;
  onConfirmationPresented: () => void;
  onNavigate: (route: CatalogRoute) => void;
  onDisconnect: () => void;
}) {
  const [show, setShow] = useState<ShowDetails | undefined>(showOverride);
  const [loadedItemId, setLoadedItemId] = useState<string | undefined>(
    showOverride ? itemId : undefined,
  );
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (showOverride) {
      setShow(showOverride);
      setLoadedItemId(itemId);
      return;
    }
    if (demoState === 'loading') {
      setShow(undefined);
      setLoadedItemId(undefined);
      return;
    }
    if (demoState === 'empty') {
      setShow(undefined);
      setLoadedItemId(undefined);
      setError('This item is no longer available on the server.');
      return;
    }
    if (demoState === 'error') {
      setShow(undefined);
      setLoadedItemId(undefined);
      setError('The Jellyfin server could not be reached.');
      return;
    }

    let active = true;
    setError(undefined);
    void bridge
      .request('catalog.query', { kind: 'details', itemId })
      .then(async (result) => {
        if (!active) return;
        const details = showDetailsFromResult(result);
        if (details.episodes.length === 0 && details.seriesId) {
          const episodes: EpisodeDetails[] = [];
          let startIndex = 0;
          let total = Number.POSITIVE_INFINITY;
          while (startIndex < total) {
            const episodeResult = await bridge.request('catalog.query', {
              kind: 'episodes',
              seriesId: details.seriesId,
              startIndex,
              limit: 200,
            });
            if (!active) return;
            if (isItemsResult(episodeResult) && episodeResult.StartIndex < startIndex) break;
            const page = episodesFromResult(episodeResult);
            episodes.push(...page);
            if (!isItemsResult(episodeResult) || episodeResult.Items.length === 0) break;
            total = episodeResult.TotalRecordCount;
            startIndex = episodeResult.StartIndex + episodeResult.Items.length;
          }
          details.episodes = episodes;
          details.seasons = seasonsFromEpisodes(episodes);
        }
        setShow(details);
        setLoadedItemId(itemId);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'The item could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [bridge, demoState, itemId, refreshKey, retry, showOverride]);

  if (show && loadedItemId === itemId)
    return (
      <DetailsScreen
        key={show.id}
        bridge={bridge}
        show={show}
        playbackConfirmation={playbackConfirmation}
        onConfirmationPresented={onConfirmationPresented}
        onNavigate={onNavigate}
        onDisconnect={onDisconnect}
      />
    );

  return (
    <main className="details-loading-shell">
      <AppChrome route="details" onNavigate={onNavigate} onDisconnect={onDisconnect} translucent />
      {error ? (
        <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : (
        <div className="details-loading" aria-busy="true" aria-label="Loading item details">
          <SpinnerGap className="spin" size={28} aria-hidden="true" />
          <span>Loading details…</span>
        </div>
      )}
    </main>
  );
}

export function CatalogApp({
  bridge: bridgeProp,
  initialConnected,
  initialRoute = 'home',
  demoState = 'default',
  showOverride,
}: CatalogAppProps) {
  const [bridge] = useState(() => bridgeProp ?? createCatalogBridge());
  const [connected, setConnected] = useState<boolean | undefined>(initialConnected);
  const [route, setRoute] = useState<CatalogRoute>(initialRoute);
  const [selectedItemId, setSelectedItemId] = useState('horizons');
  const [refreshKey, setRefreshKey] = useState(0);
  const [playbackConfirmation, setPlaybackConfirmation] = useState<
    PlaybackConfirmationNotice | undefined
  >();

  useEffect(() => {
    if (initialConnected !== undefined) return;
    let active = true;
    void bridge
      .request('catalog.refresh', {})
      .then((result) => {
        if (active) setConnected(result.connection !== undefined);
      })
      .catch(() => {
        if (active) setConnected(false);
      });
    return () => {
      active = false;
    };
  }, [bridge, initialConnected]);

  useEffect(() => {
    return bridge.subscribeInvalidation?.(() => {
      if (document.visibilityState === 'hidden') return;
      setRefreshKey((value) => value + 1);
    });
  }, [bridge]);

  useEffect(() => {
    return bridge.subscribePlaybackConfirmation?.((notice) => {
      setSelectedItemId(notice.itemId);
      setPlaybackConfirmation(notice);
      setRoute('details');
    });
  }, [bridge]);

  useEffect(() => {
    if (!connected) return;
    let latestRefresh = 0;
    const refreshVisibleData = () => {
      const now = Date.now();
      if (now - latestRefresh < 5_000 || document.visibilityState === 'hidden') return;
      latestRefresh = now;
      void bridge
        .request('catalog.refresh', {})
        .then(() => {
          setRefreshKey((value) => value + 1);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(refreshVisibleData, 60_000);
    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
    };
  }, [bridge, connected, route]);

  const disconnect = useCallback(() => {
    void bridge.request('connection.disconnect', {}).finally(() => {
      setConnected(false);
      setPlaybackConfirmation(undefined);
      setRoute('home');
    });
  }, [bridge]);

  const selectItem = useCallback((item: MediaCard) => {
    setSelectedItemId(item.id);
    setRoute('details');
  }, []);
  const clearPlaybackConfirmation = useCallback(() => setPlaybackConfirmation(undefined), []);

  if (connected === undefined) {
    return (
      <main className="boot-screen" aria-busy="true">
        <SpinnerGap className="spin" size={30} aria-hidden="true" />
        <span>Opening Jellyfin…</span>
      </main>
    );
  }

  if (!connected) {
    return (
      <ConnectionScreen
        bridge={bridge}
        onConnected={() => {
          setConnected(true);
          setRoute('home');
        }}
      />
    );
  }

  if (route === 'details') {
    return (
      <DetailsLoader
        bridge={bridge}
        itemId={selectedItemId}
        demoState={demoState}
        refreshKey={refreshKey}
        showOverride={showOverride}
        playbackConfirmation={playbackConfirmation}
        onConfirmationPresented={clearPlaybackConfirmation}
        onNavigate={setRoute}
        onDisconnect={disconnect}
      />
    );
  }

  return (
    <div className="catalog-shell">
      <AppChrome route={route} onNavigate={setRoute} onDisconnect={disconnect} />
      <main className="catalog-main">
        {route === 'home' ? (
          <HomeScreen
            bridge={bridge}
            demoState={demoState}
            refreshKey={refreshKey}
            onSelect={selectItem}
          />
        ) : null}
        {route === 'movies' ? (
          <GridScreen
            bridge={bridge}
            demoState={demoState}
            refreshKey={refreshKey}
            onSelect={selectItem}
            kind="movie"
          />
        ) : null}
        {route === 'shows' ? (
          <GridScreen
            bridge={bridge}
            demoState={demoState}
            refreshKey={refreshKey}
            onSelect={selectItem}
            kind="series"
          />
        ) : null}
        {route === 'search' ? (
          <SearchScreen
            bridge={bridge}
            demoState={demoState}
            refreshKey={refreshKey}
            onSelect={selectItem}
          />
        ) : null}
      </main>
    </div>
  );
}
