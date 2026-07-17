import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogErrorBoundary } from '../src/catalog/CatalogErrorBoundary';
import {
  announceCatalogReady,
  installCatalogCrashDiagnostics,
  showCatalogBootstrapFailure,
  type CatalogCrashDiagnostics,
} from '../src/catalog/diagnostics';

let diagnostics: CatalogCrashDiagnostics | undefined;

function installWithBridge() {
  const postMessage = vi.fn();
  Object.defineProperty(window, 'iina', {
    configurable: true,
    value: { postMessage, onMessage: vi.fn() },
  });
  diagnostics = installCatalogCrashDiagnostics(window);
  return postMessage;
}

afterEach(() => {
  diagnostics?.dispose();
  diagnostics = undefined;
  Reflect.deleteProperty(window, 'iina');
  document.body.replaceChildren();
});

describe('catalog crash diagnostics', () => {
  it('announces a mounted catalog through a narrow, payload-free message', () => {
    const postMessage = installWithBridge();

    expect(() => announceCatalogReady(window)).not.toThrow();

    expect(postMessage).toHaveBeenCalledWith('catalog.ready', {});
  });

  it('forwards a bounded, redacted window error through the narrow native message', () => {
    const postMessage = installWithBridge();
    const error = new Error(
      `Authorization: Bearer browser-secret at https://media.example/items?ApiKey=query-secret ${'x'.repeat(2_000)}`,
    );
    Object.defineProperty(error, 'stack', {
      value: `at /Users/alice/private/catalog.tsx:4:2\nat https://media.example/catalog.js?token=stack-secret:${'9'.repeat(5_000)}`,
    });

    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    const [name, record] = postMessage.mock.calls[0] as [string, Record<string, string>];
    expect(name).toBe('catalog.diagnostic');
    expect(record.kind).toBe('window-error');
    expect(record.message.length).toBeLessThanOrEqual(1_024);
    expect(record.stack.length).toBeLessThanOrEqual(4_096);
    expect(JSON.stringify(record)).not.toContain('browser-secret');
    expect(JSON.stringify(record)).not.toContain('query-secret');
    expect(JSON.stringify(record)).not.toContain('stack-secret');
    expect(JSON.stringify(record)).not.toContain('media.example');
    expect(JSON.stringify(record)).not.toContain('/Users/alice');
  });

  it('reports rejection reasons without serializing hostile objects or duplicate failures', () => {
    const postMessage = installWithBridge();
    const reason = { accessToken: 'must-not-be-read' };
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: reason });

    window.dispatchEvent(event);
    window.dispatchEvent(event);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(postMessage.mock.calls[0])).toContain('non-error value');
    expect(JSON.stringify(postMessage.mock.calls[0])).not.toContain('must-not-be-read');
  });

  it('never throws if the native diagnostic bridge itself fails', () => {
    Object.defineProperty(window, 'iina', {
      configurable: true,
      value: {
        postMessage: () => {
          throw new Error('bridge unavailable');
        },
        onMessage: vi.fn(),
      },
    });
    diagnostics = installCatalogCrashDiagnostics(window);

    expect(() => diagnostics?.report('bootstrap', new Error('catalog failed'))).not.toThrow();
  });
});

describe('catalog crash fallback', () => {
  it('replaces a failed bootstrap with a visible, non-sensitive error state', () => {
    document.body.innerHTML = '<div id="root"><p>Opening your library…</p></div>';

    showCatalogBootstrapFailure(document);

    expect(screen.getByRole('alert')).toHaveTextContent('The library couldn’t open');
    expect(screen.getByRole('alert')).toHaveTextContent('Diagnostic details were saved');
    expect(screen.queryByText('Opening your library…')).not.toBeInTheDocument();
  });

  it('catches React render failures, shows the fallback, and reports the failure', () => {
    const postMessage = installWithBridge();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const suppressJSDOMError = (event: ErrorEvent): void => event.preventDefault();
    window.addEventListener('error', suppressJSDOMError);

    function BrokenCatalog(): never {
      throw new Error('render broke with token=render-secret');
    }

    render(
      <CatalogErrorBoundary
        onError={(error, componentStack) =>
          diagnostics?.report('react-render', error, componentStack)
        }
      >
        <BrokenCatalog />
      </CatalogErrorBoundary>,
    );
    window.removeEventListener('error', suppressJSDOMError);

    expect(screen.getByRole('alert')).toHaveTextContent('The library couldn’t open');
    const renderDiagnostic = postMessage.mock.calls.find(
      (call) => (call[1] as { kind?: unknown }).kind === 'react-render',
    );
    expect(renderDiagnostic?.[1]).toMatchObject({ kind: 'react-render' });
    expect(JSON.stringify(renderDiagnostic)).not.toContain('render-secret');
    consoleError.mockRestore();
  });
});
