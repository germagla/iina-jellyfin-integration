import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogApp } from './catalog/CatalogApp';
import { CatalogErrorBoundary } from './catalog/CatalogErrorBoundary';
import type { CatalogRoute } from './catalog/Chrome';
import type { DemoSurfaceState } from './catalog/SurfaceState';
import {
  announceCatalogReady,
  installCatalogCrashDiagnostics,
  showCatalogBootstrapFailure,
} from './catalog/diagnostics';

const crashDiagnostics = installCatalogCrashDiagnostics();

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Catalog root element is missing.');

  const query = new URLSearchParams(window.location.search);
  const routeParam = query.get('screen');
  const stateParam = query.get('state');
  const validRoutes: CatalogRoute[] = ['home', 'library', 'search', 'details'];
  const validStates: DemoSurfaceState[] = ['default', 'loading', 'empty', 'error'];

  createRoot(rootElement).render(
    <StrictMode>
      <CatalogErrorBoundary
        onError={(error, componentStack) =>
          crashDiagnostics.report('react-render', error, componentStack)
        }
      >
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
      </CatalogErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  crashDiagnostics.report('bootstrap', error);
  showCatalogBootstrapFailure();
}

// IINA may open a standalone window before its file-backed WKWebView has painted.
// Announcing after this task lets the global entry repeat the pending open once.
setTimeout(() => announceCatalogReady(), 0);
