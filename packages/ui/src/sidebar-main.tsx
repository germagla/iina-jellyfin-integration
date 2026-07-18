import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarApp } from './sidebar/SidebarApp';
import { installPlayerWebviewErrorReporting, reportPlayerWebviewError } from './sidebar/host';

installPlayerWebviewErrorReporting('sidebar');

class SidebarErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    reportPlayerWebviewError('sidebar', 'render', error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="sidebar-fallback" role="alert">
          <strong>Couldn’t load Jellyfin</strong>
          <span>The sidebar will retry once. Close this player window if this remains.</span>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Sidebar root element is missing.');

createRoot(rootElement).render(
  <StrictMode>
    <SidebarErrorBoundary>
      <SidebarApp />
    </SidebarErrorBoundary>
  </StrictMode>,
);
