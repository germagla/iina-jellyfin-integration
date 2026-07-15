import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedApiContext } from '@iina-jellyfin/core';
import { ArtworkCache, clampArtworkCacheLimit, type IinaFileApi } from '../src/artwork-cache';
import type { IinaHttpTransport } from '../src/iina-http';

function createFileApi() {
  const text = new Map<string, string>();
  const binary = new Map<string, Uint8Array>();
  const file: IinaFileApi = {
    exists: (path) => text.has(path) || binary.has(path),
    read: (path) => text.get(path),
    write: (path, value) => text.set(path, value),
    delete: (path) => {
      text.delete(path);
      binary.delete(path);
    },
    handle: (path) => ({
      readToEnd: () => binary.get(path),
      close: () => undefined,
    }),
  };
  return { file, text, binary };
}

const context: AuthenticatedApiContext = {
  serverUrl: 'https://media.example.test/jellyfin',
  userId: 'user',
  accessToken: 'secret',
  deviceId: 'device-1234567890',
  version: '0.1.0',
};

const request = {
  itemId: 'item',
  imageType: 'Backdrop' as const,
  imageTag: 'tag',
  width: 640,
  height: 360,
  quality: 80,
};

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x01]);

describe('ArtworkCache', () => {
  it('returns opaque data URLs and reuses private cache files', async () => {
    const { file, binary } = createFileApi();
    const download = vi.fn(async (_request: unknown, destination: string) => {
      binary.set(destination, jpeg);
    });
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport, 100, 20);

    await expect(cache.fetchDataUrl(request, context)).resolves.toBe(
      'data:image/jpeg;base64,/9j/AQ==',
    );
    await expect(cache.fetchDataUrl(request, context)).resolves.toContain('data:image/jpeg');
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('partitions entries by normalized server URL and user ID', async () => {
    const { file, binary } = createFileApi();
    const destinations = new Set<string>();
    const download = vi.fn(async (_request: unknown, destination: string) => {
      destinations.add(destination);
      binary.set(destination, jpeg);
    });
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport);

    await cache.fetchDataUrl(request, context);
    await cache.fetchDataUrl(request, { ...context, serverUrl: `${context.serverUrl}/` });
    await cache.fetchDataUrl(request, { ...context, userId: 'another-user' });
    await cache.fetchDataUrl(request, {
      ...context,
      serverUrl: 'https://other.example.test/jellyfin',
    });

    expect(download).toHaveBeenCalledTimes(3);
    expect(destinations).toHaveLength(3);
  });

  it('verifies the canonical key before serving a hashed cache slot', async () => {
    const { file, text, binary } = createFileApi();
    const download = vi.fn(async (_request: unknown, destination: string) => {
      binary.set(destination, jpeg);
    });
    const transport = { download } as unknown as IinaHttpTransport;

    await new ArtworkCache(file, transport).fetchDataUrl(request, context);
    const persisted = JSON.parse(text.get('@data/artwork-index.json') ?? '{}') as {
      entries: Record<string, { canonicalKey: string }>;
    };
    const key = Object.keys(persisted.entries)[0];
    if (key === undefined) throw new Error('Expected an artwork cache entry');
    persisted.entries[key]!.canonicalKey = '["different-canonical-key"]';
    text.set('@data/artwork-index.json', JSON.stringify(persisted));

    await expect(
      new ArtworkCache(file, transport).fetchDataUrl(request, context),
    ).resolves.toContain('data:image/jpeg');
    expect(download).toHaveBeenCalledTimes(2);
    expect(text.get('@data/artwork-index.json')).not.toContain(context.accessToken);
  });

  it('single-flights simultaneous requests for the same artwork', async () => {
    const { file, binary } = createFileApi();
    let finishDownload: (() => void) | undefined;
    const download = vi.fn(
      (_request: unknown, destination: string) =>
        new Promise<void>((resolve) => {
          finishDownload = () => {
            binary.set(destination, jpeg);
            resolve();
          };
        }),
    );
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport);

    const first = cache.fetchDataUrl(request, context);
    const second = cache.fetchDataUrl(request, context);
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    finishDownload?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      'data:image/jpeg;base64,/9j/AQ==',
      'data:image/jpeg;base64,/9j/AQ==',
    ]);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('caps concurrent downloads while allowing queued requests to finish', async () => {
    const { file, binary } = createFileApi();
    const pending: Array<() => void> = [];
    let active = 0;
    let highestActive = 0;
    const download = vi.fn(
      (_request: unknown, destination: string) =>
        new Promise<void>((resolve) => {
          active += 1;
          highestActive = Math.max(highestActive, active);
          pending.push(() => {
            binary.set(destination, jpeg);
            active -= 1;
            resolve();
          });
        }),
    );
    const cache = new ArtworkCache(
      file,
      { download } as unknown as IinaHttpTransport,
      50 * 1024 * 1024,
      20,
      2,
    );

    const requests = [
      cache.fetchDataUrl({ ...request, itemId: 'one' }, context),
      cache.fetchDataUrl({ ...request, itemId: 'two' }, context),
      cache.fetchDataUrl({ ...request, itemId: 'three' }, context),
    ];
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(highestActive).toBe(2);

    pending.shift()?.();
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(3));
    expect(highestActive).toBe(2);
    pending.splice(0).forEach((finish) => finish());

    await expect(Promise.all(requests)).resolves.toHaveLength(3);
  });

  it('deletes partial files when a download rejects', async () => {
    const { file, binary } = createFileApi();
    const download = vi.fn(async (_request: unknown, destination: string) => {
      binary.set(destination, jpeg);
      throw new Error('network interrupted');
    });
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport);

    await expect(cache.fetchDataUrl(request, context)).rejects.toThrow('network interrupted');
    expect([...binary.keys()]).toHaveLength(0);
  });

  it('deletes artwork that exceeds the configured per-image limit', async () => {
    const { file, binary } = createFileApi();
    const download = vi.fn(async (_request: unknown, destination: string) => {
      binary.set(destination, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0]));
    });
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport, 100, 10);

    await expect(cache.fetchDataUrl(request, context)).rejects.toThrow('per-image cache limit');
    expect([...binary.keys()]).toHaveLength(0);
  });

  it('clamps preference-derived total cache limits to safe bounds', () => {
    expect(clampArtworkCacheLimit(-1)).toBe(8 * 1024 * 1024);
    expect(clampArtworkCacheLimit(2 ** 40)).toBe(512 * 1024 * 1024);
    expect(clampArtworkCacheLimit(Number.NaN)).toBe(50 * 1024 * 1024);
  });

  it('rejects oversized request dimensions before network access', async () => {
    const { file } = createFileApi();
    const download = vi.fn();
    const cache = new ArtworkCache(file, { download } as unknown as IinaHttpTransport);

    await expect(
      cache.fetchDataUrl({ ...request, width: 4096, height: 4096 }, context),
    ).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });
});
