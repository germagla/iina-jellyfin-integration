import { CaretLeft, CaretRight, MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { CatalogBridge, HomeCatalog, MediaCard } from '../bridge/contracts';
import { mediaCardsFromResult } from '../bridge/adapters';
import { ProgressBar } from '../components/ProgressBar';
import { BrokeredArtwork } from './Artwork';
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
  return (
    <button
      type="button"
      className={`media-card${wide ? ' media-card--wide' : ''}`}
      onClick={() => onSelect(item)}
      aria-label={`Open ${item.title}`}
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
        {item.unwatchedCount ? (
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

function Shelf({
  bridge,
  title,
  items,
  onSelect,
  wide = false,
}: {
  bridge: CatalogBridge;
  title: string;
  items: MediaCard[];
  onSelect: (item: MediaCard) => void;
  wide?: boolean;
}) {
  return (
    <section
      className="catalog-section"
      aria-labelledby={`shelf-${title.replaceAll(' ', '-').toLowerCase()}`}
    >
      <div className="section-heading">
        <h2 id={`shelf-${title.replaceAll(' ', '-').toLowerCase()}`}>{title}</h2>
        <span>{items.length} items</span>
      </div>
      <div className="media-shelf">
        {items.map((item) => (
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
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    if (demoState !== 'default') {
      setLoading(demoState === 'loading');
      setError(demoState === 'error' ? 'The Jellyfin server could not be reached.' : undefined);
      setHome(
        demoState === 'empty' ? { continueWatching: [], nextUp: [], recentlyAdded: [] } : undefined,
      );
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(undefined);
    void Promise.all([
      bridge.request('catalog.query', { kind: 'home', shelf: 'continueWatching', limit: 20 }),
      bridge.request('catalog.query', { kind: 'home', shelf: 'nextUp', limit: 20 }),
      bridge.request('catalog.query', { kind: 'home', shelf: 'recentlyAdded', limit: 20 }),
    ])
      .then(([continueWatching, nextUp, recentlyAdded]) => {
        if (!active) return;
        setHome({
          continueWatching: mediaCardsFromResult(continueWatching).items,
          nextUp: mediaCardsFromResult(nextUp).items,
          recentlyAdded: mediaCardsFromResult(recentlyAdded).items,
        });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'The request failed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bridge, demoState, refreshKey, retry]);

  if (loading) return <CatalogSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />;
  if (
    !home ||
    [home.continueWatching, home.nextUp, home.recentlyAdded].every((items) => items.length === 0)
  ) {
    return (
      <EmptyState
        title="Your library is quiet"
        detail="Continue watching and recently added titles will appear here."
      />
    );
  }

  return (
    <div className="home-screen">
      <div className="page-introduction">
        <p>Living Room Server</p>
        <h1>Library</h1>
      </div>
      {home.continueWatching.length ? (
        <Shelf
          bridge={bridge}
          title="Continue Watching"
          items={home.continueWatching}
          onSelect={onSelect}
          wide
        />
      ) : null}
      {home.nextUp.length ? (
        <Shelf bridge={bridge} title="Next Up" items={home.nextUp} onSelect={onSelect} wide />
      ) : null}
      {home.recentlyAdded.length ? (
        <Shelf
          bridge={bridge}
          title="Recently Added"
          items={home.recentlyAdded}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

interface GridScreenProps extends ScreenProps {
  kind: 'movie' | 'series';
}

export function GridScreen({
  bridge,
  demoState = 'default',
  refreshKey = 0,
  onSelect,
  kind,
}: GridScreenProps) {
  const [sort, setSort] = useState<'recent' | 'title' | 'year'>('recent');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaCard[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const title = kind === 'movie' ? 'Movies' : 'Shows';

  useEffect(() => {
    let active = true;
    if (demoState !== 'default') {
      setLoading(demoState === 'loading');
      setError(demoState === 'error' ? 'The Jellyfin server could not be reached.' : undefined);
      setItems([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(undefined);
    void bridge
      .request('catalog.query', {
        kind: 'library',
        itemType: kind === 'movie' ? 'Movie' : 'Series',
        startIndex: (page - 1) * 12,
        limit: 12,
        sortBy: sort === 'title' ? 'SortName' : sort === 'year' ? 'PremiereDate' : 'DateCreated',
        sortOrder: sort === 'title' ? 'Ascending' : 'Descending',
      })
      .then((result) => {
        if (!active) return;
        const pageResult = mediaCardsFromResult(result);
        setItems(pageResult.items);
        setTotalPages(Math.max(1, Math.ceil(pageResult.total / 12)));
        setTotalItems(pageResult.total);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'The request failed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bridge, demoState, kind, page, refreshKey, retry, sort]);

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
              setSort(event.target.value as typeof sort);
              setPage(1);
            }}
          >
            <option value="recent">Recently added</option>
            <option value="title">Title</option>
            <option value="year">Release year</option>
          </select>
        </label>
      </div>

      {loading ? <CatalogSkeleton count={12} /> : null}
      {!loading && error ? (
        <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title={`No ${title.toLocaleLowerCase()} found`} />
      ) : null}
      {!loading && !error && items.length ? (
        <div className="card-grid">
          {items.map((item) => (
            <MediaCardButton bridge={bridge} key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      ) : null}

      {!loading && !error && totalPages > 1 ? (
        <nav className="pagination" aria-label={`${title} pages`}>
          <button
            className="icon-button"
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <CaretLeft size={18} aria-hidden="true" />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <CaretRight size={18} aria-hidden="true" />
          </button>
        </nav>
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
  const requestSequence = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    if (demoState === 'error') {
      setError('Search is temporarily unavailable.');
      return;
    }
    if (demoState === 'loading') {
      setLoading(true);
      return;
    }

    const sequence = ++requestSequence.current;
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
  }, [bridge, demoState, query, refreshKey]);

  return (
    <div className="search-screen">
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
        {loading ? <SpinnerGap className="spin" size={20} aria-label="Searching" /> : null}
      </label>

      {!query.trim() ? (
        <EmptyState
          title="Find something to watch"
          detail="Search across movies, shows, and episodes on your server."
        />
      ) : null}
      {error ? (
        <ErrorState message={error} onRetry={() => setQuery((value) => `${value} `)} />
      ) : null}
      {!loading && !error && query.trim() && items.length === 0 ? (
        <EmptyState title="No matches" detail={`Nothing matched “${query.trim()}”.`} />
      ) : null}
      {!error && items.length ? (
        <div className="card-grid search-results" aria-live="polite">
          {items.map((item) => (
            <MediaCardButton bridge={bridge} key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
