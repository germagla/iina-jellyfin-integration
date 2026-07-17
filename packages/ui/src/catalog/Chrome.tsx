import { FilmStrip, House, MagnifyingGlass, SignOut, Television } from '@phosphor-icons/react';
import type { SupportedLibrary } from '../bridge/contracts';

export type CatalogRoute = 'home' | 'library' | 'search' | 'details';
export type CatalogReturnRoute = Exclude<CatalogRoute, 'details'>;

interface ChromeProps {
  route: CatalogRoute;
  libraries: SupportedLibrary[];
  selectedLibraryId?: string;
  activeRoute?: CatalogReturnRoute;
  onNavigate: (route: CatalogRoute) => void;
  onSelectLibrary: (libraryId: string) => void;
  onDisconnect: () => void;
  translucent?: boolean;
}

export function AppChrome({
  route,
  libraries,
  selectedLibraryId,
  activeRoute: activeRouteOverride,
  onNavigate,
  onSelectLibrary,
  onDisconnect,
  translucent = false,
}: ChromeProps) {
  const activeRoute = activeRouteOverride ?? (route === 'details' ? 'home' : route);

  return (
    <header className={`app-chrome${translucent ? ' app-chrome--translucent' : ''}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <nav className="primary-navigation" aria-label="Catalog">
        <button
          type="button"
          className={activeRoute === 'home' ? 'nav-item nav-item--active' : 'nav-item'}
          aria-current={activeRoute === 'home' ? 'page' : undefined}
          onClick={() => onNavigate('home')}
        >
          <House
            size={21}
            weight={activeRoute === 'home' ? 'fill' : 'regular'}
            aria-hidden="true"
          />
          <span>Home</span>
        </button>
        {libraries.map((library) => {
          const active = activeRoute === 'library' && selectedLibraryId === library.id;
          const Icon = library.kind === 'movie' ? FilmStrip : Television;
          return (
            <button
              type="button"
              className={active ? 'nav-item nav-item--active' : 'nav-item'}
              aria-current={active ? 'page' : undefined}
              key={library.id}
              title={library.name}
              onClick={() => onSelectLibrary(library.id)}
            >
              <Icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
              <span>{library.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={activeRoute === 'search' ? 'nav-item nav-item--active' : 'nav-item'}
          aria-current={activeRoute === 'search' ? 'page' : undefined}
          onClick={() => onNavigate('search')}
        >
          <MagnifyingGlass
            size={21}
            weight={activeRoute === 'search' ? 'fill' : 'regular'}
            aria-hidden="true"
          />
          <span>Search</span>
        </button>
      </nav>
      <button
        className="chrome-action"
        type="button"
        onClick={onDisconnect}
        aria-label="Disconnect from Jellyfin"
      >
        <SignOut size={19} aria-hidden="true" />
      </button>
    </header>
  );
}
