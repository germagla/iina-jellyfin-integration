import { BaseItemSchema } from '@iina-jellyfin/core';
import { describe, expect, it } from 'vitest';
import { toBridgeError } from '../src/bridge-error';
import { JellyfinHttpError } from '../src/iina-http';

describe('toBridgeError', () => {
  it('does not expose raw schema diagnostics to the catalog', () => {
    let validationError: unknown;
    try {
      BaseItemSchema.parse({
        Id: 'invalid-item',
        Name: 'Invalid Item',
        BackdropImageTags: 'not-an-array',
      });
    } catch (error) {
      validationError = error;
    }

    expect(toBridgeError(validationError)).toEqual({
      code: 'INVALID_SERVER_RESPONSE',
      message:
        'Jellyfin returned data this version of the plugin could not understand. Update Jellyfin for IINA and try again.',
      recoverable: true,
    });
  });

  it('preserves recoverability for safe HTTP failures', () => {
    expect(toBridgeError(new JellyfinHttpError(503, true, 'Jellyfin is unavailable.'))).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Jellyfin is unavailable.',
      recoverable: true,
    });
  });
});
