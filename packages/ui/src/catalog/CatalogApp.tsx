import { SpinnerGap } from '@phosphor-icons/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  CatalogBridge,
  EpisodeDetails,
  MediaCard,
  ShowDetails,
  SupportedLibrary,
} from '../bridge/contracts';
import { createCatalogBridge } from '../bridge/client';
import {
  episodesFromResult,
  isItemsResult,
  seasonsFromEpisodes,
  showDetailsFromResult,
  supportedLibrariesFromResult,
} from '../bridge/adapters';
import { AppChrome, type CatalogReturnRoute, type CatalogRoute } from './Chrome';
import { ConnectionScreen } from './ConnectionScreen';
import { DetailsScreen } from './DetailsScreen';
import { GridScreen, HomeScreen, SearchScreen } from './LibraryScreens';
import { type DemoSurfaceState, ErrorState } from './SurfaceState';
import { useCatalogRefreshCoordinator } from './useCatalogRefreshCoordinator';
import './catalog.css';

const MAX_SERIES_EPISODES = 5_000;
const MAX_SERIES_EPISODE_PAGES = 25;

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
  libraries,
  selectedLibraryId,
  activeRoute,
  onNavigate,
  onSelectLibrary,
  onBack,
  onDisconnect,
}: {
  bridge: CatalogBridge;
  itemId: string;
  demoState: DemoSurfaceState;
  refreshKey: number;
  showOverride?: ShowDetails;
  libraries: SupportedLibrary[];
  selectedLibraryId?: string;
  activeRoute: CatalogReturnRoute;
  onNavigate: (route: CatalogRoute) => void;
  onSelectLibrary: (libraryId: string) => void;
  onBack: () => void;
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
          let pages = 0;
          while (
            startIndex < total &&
            episodes.length < MAX_SERIES_EPISODES &&
            pages < MAX_SERIES_EPISODE_PAGES
          ) {
            pages += 1;
            const episodeResult = await bridge.request('catalog.query', {
              kind: 'episodes',
              seriesId: details.seriesId,
              startIndex,
              limit: Math.min(200, MAX_SERIES_EPISODES - episodes.length),
            });
            if (!active) return;
            if (isItemsResult(episodeResult) && episodeResult.StartIndex < startIndex) break;
            const page = episodesFromResult(episodeResult);
            episodes.push(...page);
            if (!isItemsResult(episodeResult) || episodeResult.Items.length === 0) break;
            total = Math.min(episodeResult.TotalRecordCount, MAX_SERIES_EPISODES);
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
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        onSelectLibrary={onSelectLibrary}
        onBack={onBack}
        onDisconnect={onDisconnect}
      />
    );

  return (
    <main className="details-loading-shell">
      <AppChrome
        route="details"
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        onSelectLibrary={onSelectLibrary}
        onDisconnect={onDisconnect}
        translucent
      />
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
  const [detailsReturnRoute, setDetailsReturnRoute] = useState<CatalogReturnRoute>('home');
  const [libraries, setLibraries] = useState<SupportedLibrary[]>([]);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [librariesError, setLibrariesError] = useState<string>();
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>();
  const [selectedItemId, setSelectedItemId] = useState('horizons');
  const catalogScrollPosition = useRef(0);
  const restoreCatalogScroll = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [disconnectError, setDisconnectError] = useState<string>();

  useCatalogRefreshCoordinator({
    bridge,
    enabled: connected === true,
    onRefresh: () => setRefreshKey((value) => value + 1),
  });

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
    if (!connected) {
      setLibraries([]);
      setLibrariesLoaded(false);
      setLibrariesError(undefined);
      setSelectedLibraryId(undefined);
      return;
    }

    let active = true;
    setLibrariesError(undefined);
    void bridge
      .request('catalog.query', { kind: 'libraries' })
      .then((result) => {
        if (!active) return;
        const nextLibraries = supportedLibrariesFromResult(result);
        setLibraries(nextLibraries);
        setSelectedLibraryId((current) =>
          current && nextLibraries.some((library) => library.id === current)
            ? current
            : nextLibraries[0]?.id,
        );
        setLibrariesLoaded(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setLibrariesError(
          reason instanceof Error ? reason.message : 'Jellyfin libraries could not be loaded.',
        );
        setLibrariesLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [bridge, connected, refreshKey]);

  useEffect(() => {
    if (!librariesLoaded) return;
    if (selectedLibraryId && libraries.some((library) => library.id === selectedLibraryId)) return;
    setSelectedLibraryId(libraries[0]?.id);
    if (route === 'library' && libraries.length === 0) setRoute('home');
  }, [libraries, librariesLoaded, route, selectedLibraryId]);

  useLayoutEffect(() => {
    if (route === 'details') {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      return;
    }
    if (!restoreCatalogScroll.current) return;
    restoreCatalogScroll.current = false;
    document.documentElement.scrollTop = catalogScrollPosition.current;
    document.body.scrollTop = catalogScrollPosition.current;
  }, [route]);

  const disconnect = useCallback(() => {
    setDisconnectError(undefined);
    void bridge
      .request('connection.disconnect', {})
      .then(() => {
        setConnected(false);
        setLibraries([]);
        setSelectedLibraryId(undefined);
        setRoute('home');
      })
      .catch((reason: unknown) => {
        setDisconnectError(
          reason instanceof Error ? reason.message : 'Jellyfin could not be disconnected safely.',
        );
      });
  }, [bridge]);

  const navigate = useCallback((destination: CatalogRoute) => {
    restoreCatalogScroll.current = false;
    setRoute(destination);
  }, []);
  const selectLibrary = useCallback(
    (libraryId: string) => {
      if (!libraries.some((library) => library.id === libraryId)) return;
      restoreCatalogScroll.current = false;
      setSelectedLibraryId(libraryId);
      setRoute('library');
    },
    [libraries],
  );
  const selectItem = useCallback(
    (item: MediaCard) => {
      catalogScrollPosition.current = Math.max(
        document.documentElement.scrollTop,
        document.body.scrollTop,
      );
      setDetailsReturnRoute(route === 'details' ? detailsReturnRoute : route);
      setSelectedItemId(item.id);
      setRoute('details');
    },
    [detailsReturnRoute, route],
  );
  const returnToCatalog = useCallback(() => {
    restoreCatalogScroll.current = true;
    setRoute(detailsReturnRoute);
  }, [detailsReturnRoute]);
  const selectedLibrary = libraries.find((library) => library.id === selectedLibraryId);

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

  const visibleCatalogRoute: CatalogReturnRoute = route === 'details' ? detailsReturnRoute : route;

  return (
    <>
      {disconnectError ? (
        <p className="catalog-global-error" role="alert">
          {disconnectError}
        </p>
      ) : null}
      {librariesError && route !== 'details' ? (
        <p className="catalog-global-error" role="alert">
          Libraries could not be refreshed: {librariesError}
        </p>
      ) : null}
      <div className="catalog-shell" hidden={route === 'details'}>
        <AppChrome
          route={visibleCatalogRoute}
          libraries={libraries}
          selectedLibraryId={selectedLibraryId}
          onNavigate={navigate}
          onSelectLibrary={selectLibrary}
          onDisconnect={disconnect}
        />
        <main className="catalog-main">
          {visibleCatalogRoute === 'home' ? (
            <HomeScreen
              bridge={bridge}
              demoState={demoState}
              refreshKey={refreshKey}
              onSelect={selectItem}
            />
          ) : null}
          {visibleCatalogRoute === 'library' && selectedLibrary ? (
            <GridScreen
              key={selectedLibrary.id}
              bridge={bridge}
              demoState={demoState}
              refreshKey={refreshKey}
              onSelect={selectItem}
              library={selectedLibrary}
            />
          ) : null}
          {visibleCatalogRoute === 'library' && !selectedLibrary && !librariesLoaded ? (
            <div className="details-loading" aria-busy="true" aria-label="Loading libraries">
              <SpinnerGap className="spin" size={28} aria-hidden="true" />
              <span>Loading libraries…</span>
            </div>
          ) : null}
          {visibleCatalogRoute === 'search' ? (
            <SearchScreen
              bridge={bridge}
              demoState={demoState}
              refreshKey={refreshKey}
              onSelect={selectItem}
            />
          ) : null}
        </main>
      </div>
      {route === 'details' ? (
        <DetailsLoader
          bridge={bridge}
          itemId={selectedItemId}
          demoState={demoState}
          refreshKey={refreshKey}
          showOverride={showOverride}
          libraries={libraries}
          selectedLibraryId={selectedLibraryId}
          activeRoute={detailsReturnRoute}
          onNavigate={navigate}
          onSelectLibrary={selectLibrary}
          onBack={returnToCatalog}
          onDisconnect={disconnect}
        />
      ) : null}
    </>
  );
}
