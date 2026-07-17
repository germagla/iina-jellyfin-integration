import { Component, type ErrorInfo, type ReactNode } from 'react';

interface CatalogErrorBoundaryProps {
  children: ReactNode;
  onError(error: Error, componentStack?: string): void;
}

interface CatalogErrorBoundaryState {
  failed: boolean;
}

export class CatalogErrorBoundary extends Component<
  CatalogErrorBoundaryProps,
  CatalogErrorBoundaryState
> {
  state: CatalogErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): CatalogErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(error, info.componentStack ?? undefined);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="connection-screen catalog-crash-fallback" role="alert">
          <section className="connection-card">
            <p className="connection-eyebrow">Jellyfin for IINA</p>
            <h1>The library couldn’t open</h1>
            <p className="connection-intro">
              Close and reopen this window. Diagnostic details were saved to the Jellyfin log.
            </p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
