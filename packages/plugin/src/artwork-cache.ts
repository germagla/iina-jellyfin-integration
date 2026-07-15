import {
  ArtworkRequestSchema,
  buildArtworkHttpRequest,
  normalizeServerUrl,
  type ArtworkRequest,
  type AuthenticatedApiContext,
} from '@iina-jellyfin/core';
import { DEFAULT_ARTWORK_LIMIT_BYTES } from './constants';
import { bytesToBase64, detectImageMimeType } from './base64';
import type { IinaHttpTransport } from './iina-http';

const INDEX_PATH = '@data/artwork-index.json';
const CACHE_PREFIX = '@data/artwork-';
const DEFAULT_TOTAL_BYTES = 50 * 1024 * 1024;
const MIN_TOTAL_BYTES = DEFAULT_ARTWORK_LIMIT_BYTES;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const DEFAULT_CONCURRENT_DOWNLOADS = 4;
const MAX_CONCURRENT_DOWNLOADS = 8;

interface CacheEntry {
  canonicalKey: string;
  path: string;
  bytes: number;
  lastAccessAt: number;
}

interface CacheIndex {
  version: 2;
  entries: Record<string, CacheEntry>;
}

export interface IinaFileApi {
  exists(path: string): boolean;
  read(path: string): string | undefined;
  write(path: string, content: string): void;
  delete(path: string): void;
  handle(
    path: string,
    mode: string,
  ): {
    readToEnd(): Uint8Array | undefined;
    close(): void;
  };
}

export function clampArtworkCacheLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TOTAL_BYTES;
  return Math.min(MAX_TOTAL_BYTES, Math.max(MIN_TOTAL_BYTES, Math.trunc(value)));
}

function clampSingleArtworkLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ARTWORK_LIMIT_BYTES;
  return Math.min(DEFAULT_ARTWORK_LIMIT_BYTES, Math.max(1, Math.trunc(value)));
}

function clampConcurrentDownloads(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENT_DOWNLOADS;
  return Math.min(MAX_CONCURRENT_DOWNLOADS, Math.max(1, Math.trunc(value)));
}

function canonicalCacheKey(request: ArtworkRequest, context: AuthenticatedApiContext): string {
  const serverUrl = normalizeServerUrl(context.serverUrl, { allowInsecureRemote: true }).url;
  return JSON.stringify([
    serverUrl,
    context.userId,
    request.itemId,
    request.imageType,
    request.imageTag ?? '',
    request.width,
    request.height,
    request.quality,
  ]);
}

function cacheKey(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function cachePath(key: string): string {
  return `${CACHE_PREFIX}${key}.bin`;
}

function emptyIndex(): CacheIndex {
  return { version: 2, entries: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCacheEntry(value: unknown, key: string): value is CacheEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.canonicalKey === 'string' &&
    value.canonicalKey.length > 0 &&
    value.path === cachePath(key) &&
    typeof value.bytes === 'number' &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    typeof value.lastAccessAt === 'number' &&
    Number.isFinite(value.lastAccessAt) &&
    value.lastAccessAt >= 0
  );
}

export class ArtworkCache {
  private readonly maxTotalBytes: number;
  private readonly maxSingleBytes: number;
  private readonly maxConcurrentDownloads: number;
  private readonly inFlight = new Map<string, Promise<string>>();
  private readonly slotLocks = new Map<string, Promise<void>>();
  private readonly downloadWaiters: Array<() => void> = [];
  private activeDownloads = 0;
  private index: CacheIndex;

  constructor(
    private readonly file: IinaFileApi,
    private readonly transport: IinaHttpTransport,
    maxTotalBytes = DEFAULT_TOTAL_BYTES,
    maxSingleBytes = DEFAULT_ARTWORK_LIMIT_BYTES,
    maxConcurrentDownloads = DEFAULT_CONCURRENT_DOWNLOADS,
  ) {
    this.maxTotalBytes = clampArtworkCacheLimit(maxTotalBytes);
    this.maxSingleBytes = clampSingleArtworkLimit(maxSingleBytes);
    this.maxConcurrentDownloads = clampConcurrentDownloads(maxConcurrentDownloads);
    this.index = this.loadIndex();
  }

  async fetchDataUrl(
    rawRequest: ArtworkRequest,
    context: AuthenticatedApiContext,
  ): Promise<string> {
    const request = ArtworkRequestSchema.parse(rawRequest);
    const canonicalKey = canonicalCacheKey(request, context);
    const pending = this.inFlight.get(canonicalKey);
    if (pending !== undefined) return pending;

    const operation = this.fetchCanonical(request, context, canonicalKey);
    this.inFlight.set(canonicalKey, operation);
    try {
      return await operation;
    } finally {
      if (this.inFlight.get(canonicalKey) === operation) this.inFlight.delete(canonicalKey);
    }
  }

  private async fetchCanonical(
    request: ArtworkRequest,
    context: AuthenticatedApiContext,
    canonicalKey: string,
  ): Promise<string> {
    const key = cacheKey(canonicalKey);
    return this.withSlotLock(key, async () => {
      const cached = this.readCached(key, canonicalKey);
      if (cached !== undefined) return cached;

      const destination = cachePath(key);
      let bytes: Uint8Array;
      const releaseDownload = await this.acquireDownloadSlot();
      try {
        await this.transport.download(buildArtworkHttpRequest(request, context), destination);
        bytes = this.readBounded(destination);
        const mime = detectImageMimeType(bytes);
        if (!mime.startsWith('image/')) {
          throw new Error('Jellyfin returned a non-image artwork response.');
        }
      } catch (error) {
        this.deleteManagedFile(key, destination);
        throw error;
      } finally {
        releaseDownload();
      }

      this.index.entries[key] = {
        canonicalKey,
        path: destination,
        bytes: bytes.byteLength,
        lastAccessAt: Date.now(),
      };
      this.evict();
      this.persistIndex();
      return this.toDataUrl(bytes);
    });
  }

  private readCached(key: string, canonicalKey: string): string | undefined {
    const existing = this.index.entries[key];
    if (existing === undefined) return undefined;

    if (existing.canonicalKey !== canonicalKey || !this.file.exists(existing.path)) {
      this.invalidateEntry(key, existing);
      return undefined;
    }

    try {
      const bytes = this.readBounded(existing.path);
      const result = this.toDataUrl(bytes);
      existing.lastAccessAt = Date.now();
      this.persistIndex();
      return result;
    } catch {
      this.invalidateEntry(key, existing);
      return undefined;
    }
  }

  private async withSlotLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.slotLocks.get(key) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.slotLocks.set(key, current);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.slotLocks.get(key) === current) this.slotLocks.delete(key);
    }
  }

  private async acquireDownloadSlot(): Promise<() => void> {
    if (this.activeDownloads < this.maxConcurrentDownloads && this.downloadWaiters.length === 0) {
      this.activeDownloads += 1;
    } else {
      await new Promise<void>((resolve) =>
        this.downloadWaiters.push(() => {
          this.activeDownloads += 1;
          resolve();
        }),
      );
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeDownloads -= 1;
      this.downloadWaiters.shift()?.();
    };
  }

  private readBounded(path: string): Uint8Array {
    const handle = this.file.handle(path, 'read');
    try {
      const bytes = handle.readToEnd();
      if (bytes === undefined || bytes.byteLength === 0)
        throw new Error('Artwork download was empty.');
      if (bytes.byteLength > this.maxSingleBytes) {
        throw new Error('Artwork exceeded the per-image cache limit.');
      }
      return bytes;
    } finally {
      handle.close();
    }
  }

  private toDataUrl(bytes: Uint8Array): string {
    const mime = detectImageMimeType(bytes);
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  }

  private loadIndex(): CacheIndex {
    const raw = this.file.read(INDEX_PATH);
    if (raw === undefined) return emptyIndex();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.entries)) {
        this.purgeLegacyEntries(parsed);
        return emptyIndex();
      }

      const entries: Record<string, CacheEntry> = {};
      for (const [key, value] of Object.entries(parsed.entries)) {
        if (/^[0-9a-f]{8}$/.test(key) && isCacheEntry(value, key)) entries[key] = value;
      }
      return { version: 2, entries };
    } catch {
      return emptyIndex();
    }
  }

  private purgeLegacyEntries(parsed: unknown): void {
    if (!isRecord(parsed) || !isRecord(parsed.entries)) return;
    for (const [key, value] of Object.entries(parsed.entries)) {
      if (!/^[0-9a-f]{8}$/.test(key) || !isRecord(value)) continue;
      if (value.path === cachePath(key)) this.deleteManagedFile(key, value.path);
    }
  }

  private persistIndex(): void {
    this.file.write(INDEX_PATH, JSON.stringify(this.index));
  }

  private invalidateEntry(key: string, entry: CacheEntry): void {
    this.deleteManagedFile(key, entry.path);
    delete this.index.entries[key];
    this.persistIndex();
  }

  private deleteManagedFile(key: string, path: string): void {
    if (path === cachePath(key) && this.file.exists(path)) this.file.delete(path);
  }

  private evict(): void {
    const entries = Object.entries(this.index.entries).sort(
      ([, left], [, right]) => left.lastAccessAt - right.lastAccessAt,
    );
    let total = entries.reduce((sum, [, entry]) => sum + entry.bytes, 0);
    for (const [key, entry] of entries) {
      if (total <= this.maxTotalBytes) break;
      this.deleteManagedFile(key, entry.path);
      total -= entry.bytes;
      delete this.index.entries[key];
    }
  }
}
