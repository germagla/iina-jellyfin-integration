export const CATALOG_DIAGNOSTIC_MESSAGE = 'catalog.diagnostic';
export const CATALOG_READY_MESSAGE = 'catalog.ready';

export const CATALOG_DIAGNOSTIC_MESSAGE_MAX_CHARS = 1_024;
export const CATALOG_DIAGNOSTIC_STACK_MAX_CHARS = 4_096;

export const CATALOG_DIAGNOSTIC_KINDS = [
  'window-error',
  'unhandled-rejection',
  'react-render',
  'bootstrap',
] as const;

export type CatalogDiagnosticKind = (typeof CATALOG_DIAGNOSTIC_KINDS)[number];

export interface CatalogDiagnosticRecord {
  kind: CatalogDiagnosticKind;
  message: string;
  stack?: string;
}
