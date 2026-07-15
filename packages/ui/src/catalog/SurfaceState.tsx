import { ArrowClockwise, FilmSlate, WarningCircle } from '@phosphor-icons/react';

export type DemoSurfaceState = 'default' | 'loading' | 'empty' | 'error';

export function CatalogSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="card-grid" aria-label="Loading catalog" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index} aria-hidden="true">
          <span className="skeleton-block skeleton-block--artwork" />
          <span className="skeleton-block skeleton-block--title" />
          <span className="skeleton-block skeleton-block--subtitle" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  detail = 'New items will appear here as your library changes.',
}) {
  return (
    <div className="surface-state" role="status">
      <FilmSlate size={35} weight="thin" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="surface-state surface-state--error" role="alert">
      <WarningCircle size={35} weight="thin" aria-hidden="true" />
      <h2>Couldn’t load your library</h2>
      <p>{message}</p>
      <button className="secondary-button inline-button" type="button" onClick={onRetry}>
        <ArrowClockwise size={18} aria-hidden="true" />
        Try Again
      </button>
    </div>
  );
}
