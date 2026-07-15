import { FilmStrip, House, MagnifyingGlass, SignOut, Television } from '@phosphor-icons/react';

export type CatalogRoute = 'home' | 'movies' | 'shows' | 'search' | 'details';

interface ChromeProps {
  route: CatalogRoute;
  onNavigate: (route: CatalogRoute) => void;
  onDisconnect: () => void;
  translucent?: boolean;
}

const navigation = [
  { route: 'home' as const, label: 'Library', icon: House },
  { route: 'movies' as const, label: 'Movies', icon: FilmStrip },
  { route: 'shows' as const, label: 'Shows', icon: Television },
  { route: 'search' as const, label: 'Search', icon: MagnifyingGlass },
];

export function AppChrome({ route, onNavigate, onDisconnect, translucent = false }: ChromeProps) {
  const activeRoute = route === 'details' ? 'shows' : route;

  return (
    <header className={`app-chrome${translucent ? ' app-chrome--translucent' : ''}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <nav className="primary-navigation" aria-label="Catalog">
        {navigation.map(({ route: destination, label, icon: Icon }) => (
          <button
            type="button"
            className={activeRoute === destination ? 'nav-item nav-item--active' : 'nav-item'}
            aria-current={activeRoute === destination ? 'page' : undefined}
            key={destination}
            onClick={() => onNavigate(destination)}
          >
            <Icon
              size={21}
              weight={activeRoute === destination ? 'fill' : 'regular'}
              aria-hidden="true"
            />
            <span>{label}</span>
          </button>
        ))}
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
