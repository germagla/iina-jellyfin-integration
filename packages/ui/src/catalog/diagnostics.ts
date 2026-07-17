import {
  CATALOG_DIAGNOSTIC_MESSAGE,
  CATALOG_DIAGNOSTIC_MESSAGE_MAX_CHARS,
  CATALOG_DIAGNOSTIC_STACK_MAX_CHARS,
  CATALOG_READY_MESSAGE,
  redactString,
  type CatalogDiagnosticKind,
  type CatalogDiagnosticRecord,
} from '@iina-jellyfin/core';

interface DiagnosticBridgeWindow {
  iina?: {
    postMessage(name: string, data: unknown): void;
  };
}

export interface CatalogCrashDiagnostics {
  report(kind: CatalogDiagnosticKind, error: unknown, supplementalStack?: string): void;
  dispose(): void;
}

export function announceCatalogReady(targetWindow: Window = window): void {
  try {
    (targetWindow as unknown as DiagnosticBridgeWindow).iina?.postMessage(
      CATALOG_READY_MESSAGE,
      {},
    );
  } catch {
    // A ready notification is a paint-race safeguard, never a reason to fail the catalog.
  }
}

const MAX_UNIQUE_DIAGNOSTICS = 16;

function sanitizeDiagnosticText(value: string, maximum: number): string {
  const sanitized = redactString(value)
    .replace(/\/Users\/[^/\s"']+/g, '~')
    .replace(/\bhttps?:\/\/[^\s"']+/gi, '[URL_REDACTED]');
  if (sanitized.length <= maximum) return sanitized;
  return `${sanitized.slice(0, Math.max(0, maximum - 1))}…`;
}

function readError(error: unknown): { message: string; stack?: string } {
  try {
    if (error instanceof Error) {
      return {
        message: error.message || error.name || 'Unknown catalog error.',
        stack: typeof error.stack === 'string' ? error.stack : undefined,
      };
    }
    if (typeof error === 'string') return { message: error || 'Unknown catalog error.' };
    if (
      error !== null &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return { message: (error as { message: string }).message || 'Unknown catalog error.' };
    }
  } catch {
    // Hostile values must not make crash reporting throw a second exception.
  }
  return { message: 'A non-error value caused the catalog to fail.' };
}

function normalizedRecord(
  kind: CatalogDiagnosticKind,
  error: unknown,
  supplementalStack?: string,
): CatalogDiagnosticRecord {
  const detail = readError(error);
  const stackParts = [detail.stack, supplementalStack].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const record: CatalogDiagnosticRecord = {
    kind,
    message: sanitizeDiagnosticText(detail.message, CATALOG_DIAGNOSTIC_MESSAGE_MAX_CHARS),
  };
  if (stackParts.length > 0) {
    record.stack = sanitizeDiagnosticText(
      stackParts.join('\n'),
      CATALOG_DIAGNOSTIC_STACK_MAX_CHARS,
    );
  }
  return record;
}

export function installCatalogCrashDiagnostics(
  targetWindow: Window = window,
): CatalogCrashDiagnostics {
  const seen = new Set<string>();

  const report = (
    kind: CatalogDiagnosticKind,
    error: unknown,
    supplementalStack?: string,
  ): void => {
    try {
      const record = normalizedRecord(kind, error, supplementalStack);
      const fingerprint = `${record.kind}\n${record.message}\n${record.stack ?? ''}`;
      if (seen.has(fingerprint) || seen.size >= MAX_UNIQUE_DIAGNOSTICS) return;
      seen.add(fingerprint);
      (targetWindow as unknown as DiagnosticBridgeWindow).iina?.postMessage(
        CATALOG_DIAGNOSTIC_MESSAGE,
        record,
      );
    } catch {
      // Diagnostics can never be allowed to break the catalog further.
    }
  };

  const onError = (event: ErrorEvent): void => {
    report('window-error', event.error ?? event.message);
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    report('unhandled-rejection', event.reason);
  };

  targetWindow.addEventListener('error', onError);
  targetWindow.addEventListener('unhandledrejection', onUnhandledRejection);

  return {
    report,
    dispose: () => {
      targetWindow.removeEventListener('error', onError);
      targetWindow.removeEventListener('unhandledrejection', onUnhandledRejection);
    },
  };
}

export function showCatalogBootstrapFailure(targetDocument: Document = document): void {
  let root = targetDocument.getElementById('root');
  if (root === null) {
    root = targetDocument.createElement('div');
    root.id = 'root';
    targetDocument.body.append(root);
  }

  const main = targetDocument.createElement('main');
  main.className = 'connection-screen catalog-crash-fallback';
  main.setAttribute('role', 'alert');
  main.dataset.catalogCrashFallback = 'true';

  const card = targetDocument.createElement('section');
  card.className = 'connection-card';
  const eyebrow = targetDocument.createElement('p');
  eyebrow.className = 'connection-eyebrow';
  eyebrow.textContent = 'Jellyfin for IINA';
  const heading = targetDocument.createElement('h1');
  heading.textContent = 'The library couldn’t open';
  const explanation = targetDocument.createElement('p');
  explanation.className = 'connection-intro';
  explanation.textContent =
    'Close and reopen this window. Diagnostic details were saved to the Jellyfin log.';

  card.append(eyebrow, heading, explanation);
  main.append(card);
  root.replaceChildren(main);
}
