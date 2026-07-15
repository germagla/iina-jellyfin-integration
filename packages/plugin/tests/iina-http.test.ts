import { describe, expect, it } from 'vitest';
import { IinaHttpTransport } from '../src/iina-http';

const request = {
  method: 'GET' as const,
  url: 'https://media.example.test/jellyfin/System/Info/Public',
  headers: { Accept: 'application/json' },
};

describe('IinaHttpTransport', () => {
  it('maps revoked tokens to a reconnect-safe error', async () => {
    const transport = new IinaHttpTransport({
      get: async () => ({
        statusCode: 401,
        reason: 'Unauthorized',
        text: 'token secret should not escape',
        data: null,
      }),
      post: async () => ({ statusCode: 500, reason: '', text: '', data: null }),
      download: async () => undefined,
    });

    await expect(transport.execute(request)).rejects.toMatchObject({
      statusCode: 401,
      message: 'The Jellyfin session has expired. Please reconnect.',
    });
  });

  it('does not expose response bodies in server errors', async () => {
    const transport = new IinaHttpTransport({
      get: async () => ({
        statusCode: 503,
        reason: 'Unavailable',
        text: 'ApiKey=do-not-log',
        data: null,
      }),
      post: async () => ({ statusCode: 500, reason: '', text: '', data: null }),
      download: async () => undefined,
    });

    await expect(transport.execute(request)).rejects.not.toThrow('do-not-log');
  });
});
