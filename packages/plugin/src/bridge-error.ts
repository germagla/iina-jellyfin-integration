import { redactString, type BridgeError } from '@iina-jellyfin/core';
import { JellyfinHttpError } from './iina-http';

function isSchemaValidationError(error: Error): boolean {
  return (
    error.name === 'ZodError' &&
    'issues' in error &&
    Array.isArray((error as Error & { issues?: unknown }).issues)
  );
}

export function toBridgeError(error: unknown): BridgeError {
  if (error instanceof JellyfinHttpError) {
    return {
      code: error.statusCode === 401 || error.statusCode === 403 ? 'AUTH_EXPIRED' : 'NETWORK_ERROR',
      message: redactString(error.message),
      recoverable: error.recoverable,
    };
  }
  if (error instanceof Error) {
    if (isSchemaValidationError(error)) {
      return {
        code: 'INVALID_SERVER_RESPONSE',
        message:
          'Jellyfin returned data this version of the plugin could not understand. Update Jellyfin for IINA and try again.',
        recoverable: true,
      };
    }
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
    return { code, message: redactString(error.message), recoverable: true };
  }
  if (error !== null && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown; recoverable?: unknown };
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        code: candidate.code,
        message: redactString(candidate.message),
        recoverable: candidate.recoverable !== false,
      };
    }
  }
  return {
    code: 'REQUEST_FAILED',
    message: 'The request could not be completed.',
    recoverable: true,
  };
}
