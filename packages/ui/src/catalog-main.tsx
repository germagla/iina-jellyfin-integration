import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogApp } from './catalog/CatalogApp';
import type { CatalogRoute } from './catalog/Chrome';
import type { DemoSurfaceState } from './catalog/SurfaceState';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Catalog root element is missing.');

const query = new URLSearchParams(window.location.search);
const routeParam = query.get('screen');
const stateParam = query.get('state');
const validRoutes: CatalogRoute[] = ['home', 'movies', 'shows', 'search', 'details'];
const validStates: DemoSurfaceState[] = ['default', 'loading', 'empty', 'error'];

createRoot(rootElement).render(
  <StrictMode>
    <CatalogApp
      initialConnected={query.get('disconnected') === '1' ? false : undefined}
      initialRoute={
        validRoutes.includes(routeParam as CatalogRoute) ? (routeParam as CatalogRoute) : 'home'
      }
      demoState={
        validStates.includes(stateParam as DemoSurfaceState)
          ? (stateParam as DemoSurfaceState)
          : 'default'
      }
    />
  </StrictMode>,
);
