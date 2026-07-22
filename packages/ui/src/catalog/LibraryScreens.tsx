import { MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CatalogBridge, HomeCatalog, MediaCard, SupportedLibrary } from '../bridge/contracts';
import { mediaCardsFromResult } from '../bridge/adapters';
import { ProgressBar } from '../components/ProgressBar';
import { BrokeredArtwork } from './Artwork';
import { calculateShelfCapacity } from './catalog-layout';
import { groupRecentlyAdded } from './recently-added';
import { CatalogSkeleton, type DemoSurfaceState, EmptyState, ErrorState } from './SurfaceState';

interface ScreenProps {
  bridge: CatalogBridge;
  demoState?: DemoSurfaceState;
  refreshKey?: number;
  onSelect: (item: MediaCard) => void;
}

export function MediaCardButton({
  bridge,
  item,
  onSelect,
  wide = false,
}: {
  bridge: CatalogBridge;
  item: MediaCard;
  onSelect: (item: MediaCard) => void;
  wide?: boolean;
}) {
  const accessibleDetail = item.recentlyAddedEpisodeCount ? item.subtitle : undefined;

  return (
    <button
      type="button"
      className={`media-card${wide ? ' media-card--wide' : ''}`}
      onClick={() => onSelect(item)}
      aria-label={`Open ${item.title}${accessibleDetail ? `, ${accessibleDetail}` : ''}`}
      data-media-item-id={item.id}
    >
      <span className="media-card__artwork">
        <BrokeredArtwork
          bridge={bridge}
          itemId={item.id}
          imageType={item.imageType ?? (wide ? 'Thumb' : 'Primary')}
          imageTag={item.imageTag}
          width={wide ? 640 : 400}
          height={wide ? 360 : 600}
          source={item.artwork}
          alt=""
          className="media-card__image"
        />
        {item.recentlyAddedEpisodeCount ? (
          <span className="media-card__badge media-card__badge--label">
            {item.recentlyAddedEpisodeCount === 1 ? 'NEW' : `${item.recentlyAddedEpisodeCount} NEW`}
          </span>
        ) : item.unwatchedCount ? (
          <span className="media-card__badge">{item.unwatchedCount}</span>
        ) : null}
        {typeof item.progress === 'number' ? (
          <ProgressBar
            className="media-card__progress"
            label={`${Math.round(Math.min(1, Math.max(0, item.progress)) * 100)} percent watched`}
            value={item.progress}
          />
        ) : null}
      </span>
      <span className="media-card__copy">
        <strong>{item.title}</strong>
        <span>
          {item.subtitle ??
            [item.year, item.runtimeMinutes ? `${item.runtimeMinutes} min` : undefined]
              .filter(Boolean)
              .join(' · ')}
        </span>
      </span>
    </button>
  );
}

function RefreshStatus({ error, onRetry }: { error?: string; onRetry: () => void }) {
  if (error === undefined) return null;

  return (
    <div className="catalog-refresh-status catalog-refresh-status--error" role="status">
      <span>Couldn’t refresh: {error}</span>
      <button type="button" onClick={onRetry}>
        Try Again
      </button>
    </div>
  );
}

function Shelf({
  bridge,
  shelfKey,
  title,
  items,
  onSelect,
  wide = false,
}: {
  bridge: CatalogBridge;
  shelfKey: keyof HomeCatalog;
  title: string;
  items: MediaCard[];
  onSelect: (item: MediaCard) => void;
  wide?: boolean;
}) {
  const reactId = useId().replaceAll(':', '');
  const headingId = `shelf-${reactId}-heading`;
  const contentId = `shelf-${reactId}-items`;
  const shelfRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pendingFocusHandoff = useRef<'toggle' | 'first-card'>();
  const capacityRef = useRef(6);
  const [capacity, setCapacity] = useState(6);
  const [expanded, setExpanded] = useState(false);
  const [, forceFocusHandoffRender] = useState(0);

  useLayoutEffect(() => {
    const shelf = shelfRef.current;
    if (shelf === null) return;
    let timer: number | undefined;

    const updateCapacity = () => {
      const width = shelf.getBoundingClientRect().width || shelf.clientWidth;
      const nextCapacity = calculateShelfCapacity(width);
      if (nextCapacity === capacityRef.current) return;
      capacityRef.current = nextCapacity;
      setCapacity(nextCapacity);
    };
    const scheduleUpdate = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(updateCapacity, 0);
    };

    updateCapacity();
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleUpdate);
    observer?.observe(shelf);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  const hasOverflow = items.length > capacity;
  const visibleItems = expanded ? items : items.slice(0, capacity);
  const activeElement = document.activeElement;
  const toggleHasFocus = activeElement === toggleRef.current;
  const focusedItemId =
    activeElement instanceof HTMLElement && shelfRef.current?.contains(activeElement)
      ? activeElement.dataset.mediaItemId
      : undefined;
  if (focusedItemId !== undefined && !visibleItems.some((item) => item.id === focusedItemId)) {
    pendingFocusHandoff.current = hasOverflow || expanded ? 'toggle' : 'first-card';
  }
  if (toggleHasFocus && !hasOverflow && !expanded) {
    pendingFocusHandoff.current = 'first-card';
  }
  // Keep a focused toggle mounted for this commit so focus can move deliberately.
  const showToggle = hasOverflow || expanded || toggleHasFocus;

  useLayoutEffect(() => {
    const target = pendingFocusHandoff.current;
    if (target === undefined) return;
    pendingFocusHandoff.current = undefined;
    if (target === 'toggle') {
      toggleRef.current?.focus();
    } else {
      shelfRef.current?.querySelector<HTMLButtonElement>('.media-card')?.focus();
    }
    if (toggleHasFocus && !hasOverflow && !expanded) {
      forceFocusHandoffRender((value) => value + 1);
    }
  }, [capacity, expanded, hasOverflow, items, toggleHasFocus]);

  return (
    <section className="catalog-section" aria-labelledby={headingId} data-home-shelf={shelfKey}>
      <div className="section-heading">
        <h2 id={headingId}>{title}</h2>
        {showToggle ? (
          <button
            ref={toggleRef}
            className="shelf-toggle"
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            aria-label={expanded ? `Show less ${title}` : `See all ${title} (${items.length})`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Show Less' : `See All (${items.length})`}
          </button>
        ) : (
          <span>{items.length} items</span>
        )}
      </div>
      <div
        ref={shelfRef}
        id={contentId}
        className="media-shelf"
        data-expanded={expanded ? 'true' : 'false'}
      >
        {visibleItems.map((item) => (
          <MediaCardButton
            bridge={bridge}
            key={item.id}
            item={item}
            onSelect={onSelect}
            wide={wide}
          />
        ))}
      </div>
    </section>
  );
}

export function HomeScreen({
  bridge,
  demoState = 'default',
  refreshKey = 0,
  onSelect,
}: ScreenProps) {
  const [home, setHome] = useState<HomeCatalog>();
  const [initialError, setInitialError] = useState<string>();
  const [refreshError, setRefreshError] = useState<string>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const hasLoaded = useRef(false);
  const homeHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingAfterRefresh = useRef(false);

  useEffect(() => {
    let active = true;
    const sequence = ++requestSequence.current;
    if (demoState !== 'default') {
      hasLoaded.current = demoState === 'empty';
      setInitialLoading(demoState === 'loading');
      setRefreshing(false);
      setInitialError(
        demoState === 'error' ? 'The Jellyfin server could not be reached.' : undefined,
      );
      setRefreshError(undefined);
      setHome(
        demoState === 'empty' ? { continueWatching: [], nextUp: [], recentlyAdded: [] } : undefined,
      );
      return () => {
        active = false;
      };
    }

    const background = hasLoaded.current;
    setInitialLoading(!background);
    setRefreshing(background);
    if (!background) setInitialError(undefined);
    setRefreshError(undefined);
    void Promise.all([
      bridge.request('catalog.query', { kind: 'home', shelf: 'continueWatching', limit: 20 }),
      bridge.request('catalog.query', { kind: 'home', shelf: 'nextUp', limit: 20 }),
      // Scan beyond the 20 visible groups so a large season import cannot
      // crowd every other recent movie or series out of the shelf.
      bridge.request('catalog.query', { kind: 'home', shelf: 'recentlyAdded', limit: 200 }),
    ])
      .then(([continueWatching, nextUp, recentlyAdded]) => {
        if (!active || sequence !== requestSequence.current) return;
        hasLoaded.current = true;
        const nextHome = {
          continueWatching: mediaCardsFromResult(continueWatching).items,
          nextUp: mediaCardsFromResult(nextUp).items,
          recentlyAdded: groupRecentlyAdded(mediaCardsFromResult(recentlyAdded).items).slice(0, 20),
        };
        const focusedShelf =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.closest<HTMLElement>('[data-home-shelf]')?.dataset.homeShelf
            : undefined;
        if (
          (focusedShelf === 'continueWatching' ||
            focusedShelf === 'nextUp' ||
            focusedShelf === 'recentlyAdded') &&
          nextHome[focusedShelf].length === 0
        ) {
          focusHeadingAfterRefresh.current = true;
        }
        setHome(nextHome);
      })
      .catch((reason: unknown) => {
        if (!active || sequence !== requestSequence.current) return;
        const message = reason instanceof Error ? reason.message : 'The request failed.';
        if (background) setRefreshError(message);
        else setInitialError(message);
      })
      .finally(() => {
        if (!active || sequence !== requestSequence.current) return;
        setInitialLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [bridge, demoState, refreshKey, retry]);

  useLayoutEffect(() => {
    if (!focusHeadingAfterRefresh.current) return;
    focusHeadingAfterRefresh.current = false;
    homeHeadingRef.current?.focus();
  }, [home]);

  if (initialLoading && !hasLoaded.current) return <CatalogSkeleton />;
  if (initialError && !hasLoaded.current) {
    return <ErrorState message={initialError} onRetry={() => setRetry((value) => value + 1)} />;
  }
  const isEmpty =
    !home ||
    [home.continueWatching, home.nextUp, home.recentlyAdded].every((items) => items.length === 0);

  return (
    <div className="home-screen" aria-busy={initialLoading || refreshing}>
      <div className="page-introduction">
        <p>Living Room Server</p>
        <h1 ref={homeHeadingRef} tabIndex={-1}>
          Library
        </h1>
        <RefreshStatus error={refreshError} onRetry={() => setRetry((value) => value + 1)} />
      </div>
      {isEmpty ? (
        <EmptyState
          title="Your library is quiet"
          detail="Continue watching and recently added titles will appear here."
        />
      ) : null}
      {home?.continueWatching.length ? (
        <Shelf
          bridge={bridge}
          shelfKey="continueWatching"
          title="Continue Watching"
          items={home.continueWatching}
          onSelect={onSelect}
          wide
        />
      ) : null}
      {home?.nextUp.length ? (
        <Shelf
          bridge={bridge}
          shelfKey="nextUp"
          title="Next Up"
          items={home.nextUp}
          onSelect={onSelect}
          wide
        />
      ) : null}
      {home?.recentlyAdded.length ? (
        <Shelf
          bridge={bridge}
          shelfKey="recentlyAdded"
          title="Recently Added"
          items={home.recentlyAdded}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

interface GridScreenProps extends ScreenProps {
  library: SupportedLibrary;
}

const LIBRARY_BATCH_SIZE = 60;

interface LibrarySnapshot {
  items: MediaCard[];
  total: number;
  nextStartIndex: number;
  scopeKey: string;
  queryKey: string;
}

export function GridScreen({
  bridge,
  demoState = 'default',
  refreshKey = 0,
  onSelect,
  library,
}: GridScreenProps) {
  const [sort, setSort] = useState<'recent' | 'title' | 'year'>('recent');
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>();
  const snapshotRef = useRef<LibrarySnapshot>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [initialError, setInitialError] = useState<string>();
  const [refreshError, setRefreshError] = useState<string>();
  const [loadMoreError, setLoadMoreError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);
  const loadMoreButtonRef = useRef<HTMLButtonElement>(null);
  const title = library.name;
  const scopeKey = `${library.id}:${library.kind}`;
  const queryKey = `${scopeKey}:${sort}`;

  const requestLibraryPage = useCallback(
    async (startIndex: number, limit: number) => {
      const result = await bridge.request('catalog.query', {
        kind: 'library',
        itemType: library.kind === 'movie' ? 'Movie' : 'Series',
        parentId: library.id,
        startIndex,
        limit,
        sortBy: sort === 'title' ? 'SortName' : sort === 'year' ? 'PremiereDate' : 'DateCreated',
        sortOrder: sort === 'title' ? 'Ascending' : 'Descending',
      });
      return mediaCardsFromResult(result);
    },
    [bridge, library.id, library.kind, sort],
  );

  useEffect(() => {
    let active = true;
    const sequence = ++requestSequence.current;
    if (demoState !== 'default') {
      const demoSnapshot =
        demoState === 'empty'
          ? { items: [], total: 0, nextStartIndex: 0, scopeKey, queryKey }
          : undefined;
      snapshotRef.current = demoSnapshot;
      setSnapshot(demoSnapshot);
      setInitialLoading(demoState === 'loading');
      setRefreshing(false);
      refreshingRef.current = false;
      setLoadingMore(false);
      loadingMoreRef.current = false;
      setInitialError(
        demoState === 'error' ? 'The Jellyfin server could not be reached.' : undefined,
      );
      setRefreshError(undefined);
      setLoadMoreError(undefined);
      return () => {
        active = false;
      };
    }

    const previousSnapshot = snapshotRef.current;
    const background = previousSnapshot?.scopeKey === scopeKey;
    if (!background) {
      snapshotRef.current = undefined;
      setSnapshot(undefined);
    }
    setInitialLoading(!background);
    setRefreshing(background);
    refreshingRef.current = background;
    setLoadingMore(false);
    loadingMoreRef.current = false;
    if (!background) setInitialError(undefined);
    setRefreshError(undefined);
    setLoadMoreError(undefined);
    const targetCount =
      previousSnapshot?.queryKey === queryKey
        ? Math.max(LIBRARY_BATCH_SIZE, previousSnapshot.nextStartIndex)
        : LIBRARY_BATCH_SIZE;

    void (async () => {
      const items: MediaCard[] = [];
      const seenIds = new Set<string>();
      let startIndex = 0;
      let total = Number.POSITIVE_INFINITY;
      while (startIndex < targetCount && startIndex < total) {
        const page = await requestLibraryPage(startIndex, Math.min(200, targetCount - startIndex));
        if (!active || sequence !== requestSequence.current) return;
        for (const item of page.items) {
          if (seenIds.has(item.id)) continue;
          seenIds.add(item.id);
          items.push(item);
        }
        total = Math.max(page.total, page.nextStartIndex);
        if (page.nextStartIndex <= startIndex) break;
        startIndex = page.nextStartIndex;
      }
      return {
        items,
        total: Number.isFinite(total) ? total : startIndex,
        nextStartIndex: startIndex,
        scopeKey,
        queryKey,
      };
    })()
      .then((nextSnapshot) => {
        if (!nextSnapshot || !active || sequence !== requestSequence.current) return;
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
      })
      .catch((reason: unknown) => {
        if (!active || sequence !== requestSequence.current) return;
        const message = reason instanceof Error ? reason.message : 'The request failed.';
        if (background) setRefreshError(message);
        else setInitialError(message);
      })
      .finally(() => {
        if (!active || sequence !== requestSequence.current) return;
        setInitialLoading(false);
        setRefreshing(false);
        refreshingRef.current = false;
      });

    return () => {
      active = false;
    };
  }, [demoState, queryKey, refreshKey, requestLibraryPage, retry, scopeKey]);

  const loadMore = useCallback(() => {
    const current = snapshotRef.current;
    if (
      loadingMoreRef.current ||
      refreshingRef.current ||
      current === undefined ||
      current.queryKey !== queryKey ||
      current.nextStartIndex >= current.total
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(undefined);
    const sequence = requestSequence.current;
    const startIndex = current.nextStartIndex;
    void requestLibraryPage(startIndex, Math.min(LIBRARY_BATCH_SIZE, current.total - startIndex))
      .then((page) => {
        if (sequence !== requestSequence.current) return;
        const latest = snapshotRef.current;
        if (latest === undefined || latest.queryKey !== queryKey) return;
        if (page.nextStartIndex <= startIndex) {
          const nextSnapshot = { ...latest, total: startIndex, nextStartIndex: startIndex };
          snapshotRef.current = nextSnapshot;
          setSnapshot(nextSnapshot);
          setRefreshError('Jellyfin returned an incomplete library page.');
          return;
        }
        const seenIds = new Set(latest.items.map((item) => item.id));
        const appendedItems = page.items.filter((item) => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });
        const items = [...latest.items, ...appendedItems];
        const nextSnapshot = {
          items,
          total: Math.max(page.total, page.nextStartIndex),
          nextStartIndex: page.nextStartIndex,
          scopeKey,
          queryKey,
        };
        snapshotRef.current = nextSnapshot;
        setSnapshot(nextSnapshot);
      })
      .catch((reason: unknown) => {
        if (sequence !== requestSequence.current) return;
        setLoadMoreError(reason instanceof Error ? reason.message : 'More titles could not load.');
      })
      .finally(() => {
        if (sequence !== requestSequence.current) return;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [queryKey, requestLibraryPage, scopeKey]);

  const totalItems = snapshot?.total ?? 0;
  const hasMore = snapshot !== undefined && snapshot.nextStartIndex < snapshot.total;

  useEffect(() => {
    const button = loadMoreButtonRef.current;
    if (refreshing || !hasMore || button === null || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, [hasMore, loadMore, refreshing, snapshot?.nextStartIndex]);

  return (
    <div className="grid-screen">
      <div className="page-toolbar">
        <div className="page-introduction">
          <p>{totalItems ? `${totalItems} titles` : 'Your Jellyfin library'}</p>
          <h1>{title}</h1>
        </div>
        <label className="sort-control">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => {
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
              setSort(event.target.value as typeof sort);
            }}
          >
            <option value="recent">Recently added</option>
            <option value="title">Title</option>
            <option value="year">Release year</option>
          </select>
        </label>
      </div>

      <div className="catalog-grid-region" aria-busy={initialLoading || refreshing || loadingMore}>
        {initialLoading && snapshot === undefined ? <CatalogSkeleton count={12} /> : null}
        {initialError && snapshot === undefined ? (
          <ErrorState message={initialError} onRetry={() => setRetry((value) => value + 1)} />
        ) : null}
        {snapshot && snapshot.items.length === 0 ? (
          <EmptyState title={`No titles found in ${title}`} />
        ) : null}
        {snapshot?.items.length ? (
          <div className="card-grid">
            {snapshot.items.map((item) => (
              <MediaCardButton bridge={bridge} key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        ) : null}
        <RefreshStatus error={refreshError} onRetry={() => setRetry((value) => value + 1)} />
      </div>

      {hasMore ? (
        <div className="library-load-more">
          <button
            ref={loadMoreButtonRef}
            className="secondary-button library-load-more__button"
            type="button"
            onClick={loadMore}
            disabled={loadingMore || refreshing}
          >
            {loadingMore ? (
              <>
                <SpinnerGap className="spin" size={16} aria-hidden="true" />
                Loading more…
              </>
            ) : (
              `Load more · ${Math.max(0, totalItems - (snapshot?.nextStartIndex ?? 0))} remaining`
            )}
          </button>
          <RefreshStatus error={loadMoreError} onRetry={loadMore} />
        </div>
      ) : null}
    </div>
  );
}

export function SearchScreen({
  bridge,
  demoState = 'default',
  refreshKey = 0,
  onSelect,
}: ScreenProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [committedQuery, setCommittedQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      setError(undefined);
      setCommittedQuery('');
      return;
    }

    if (demoState === 'error') {
      setLoading(false);
      setError('Search is temporarily unavailable.');
      return;
    }
    if (demoState === 'loading') {
      setLoading(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(undefined);
      void bridge
        .request('catalog.query', {
          kind: 'search',
          query: trimmed,
          includeItemTypes: ['Movie', 'Series', 'Episode'],
          startIndex: 0,
          limit: 40,
        })
        .then((result) => {
          if (sequence !== requestSequence.current) return;
          setItems(demoState === 'empty' ? [] : mediaCardsFromResult(result).items);
          setCommittedQuery(trimmed);
        })
        .catch((reason: unknown) => {
          if (sequence === requestSequence.current) {
            setError(reason instanceof Error ? reason.message : 'Search failed.');
          }
        })
        .finally(() => {
          if (sequence === requestSequence.current) setLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [bridge, demoState, query, refreshKey, retry]);

  const showingCommittedResults = committedQuery.length > 0 && committedQuery === query.trim();
  const backgroundError = showingCommittedResults && error !== undefined;

  return (
    <div className="search-screen" aria-busy={loading}>
      <div className="page-introduction">
        <p>Movies and television</p>
        <h1>Search</h1>
      </div>
      <label className="search-field">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <span className="visually-hidden">Search your Jellyfin library</span>
        <input
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titles, episodes, people…"
          type="search"
        />
        {loading && !showingCommittedResults ? (
          <SpinnerGap className="spin" size={20} aria-label="Searching" />
        ) : null}
      </label>

      {!query.trim() ? (
        <EmptyState
          title="Find something to watch"
          detail="Search across movies, shows, and episodes on your server."
        />
      ) : null}
      {error && !backgroundError ? (
        <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : null}
      {showingCommittedResults && items.length === 0 ? (
        <EmptyState title="No matches" detail={`Nothing matched “${query.trim()}”.`} />
      ) : null}
      {showingCommittedResults && items.length ? (
        <div className="card-grid search-results" aria-live="polite" aria-busy={loading}>
          {items.map((item) => (
            <MediaCardButton bridge={bridge} key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
      <RefreshStatus
        error={backgroundError ? error : undefined}
        onRetry={() => setRetry((value) => value + 1)}
      />
    </div>
  );
}
