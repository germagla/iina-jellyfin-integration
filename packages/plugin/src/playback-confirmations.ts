import type { PlaybackRequest } from '@iina-jellyfin/core';
import { createOpaqueId } from './ids';

export interface PlaybackConfirmationBinding {
  connectionGeneration: number;
  managedSequence?: number;
}

interface PendingPlaybackConfirmation<Value> extends PlaybackConfirmationBinding {
  sequence: number;
  requestFingerprint: string;
  expiresAt: number;
  value: Value;
}

export interface ConsumedPlaybackConfirmation<Value> {
  value: Value;
  managedSequence?: number;
}

type ExpiryScheduler = (callback: () => void, delayMs: number) => unknown;

function fingerprintRequest(request: PlaybackRequest): string {
  return JSON.stringify([
    request.itemId,
    request.startPositionTicks,
    request.mediaSourceId ?? null,
    request.audioStreamIndex ?? null,
    request.subtitleStreamIndex ?? null,
    request.maxStreamingBitrate,
    request.openInNewWindow,
  ]);
}

/**
 * Holds the exact trusted launch that Global prepared while the catalog asks
 * the user to approve video conversion. Permits are short-lived, single-use,
 * and bound to both the normalized request and current connection/player
 * generation; the webview cannot turn one approval into a different launch.
 */
export class PlaybackConfirmationStore<Value> {
  private readonly pending = new Map<string, PendingPlaybackConfirmation<Value>>();
  private nextSequence = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = () => createOpaqueId('transcode-confirmation'),
    private readonly ttlMs = 120_000,
    private readonly maxEntries = 16,
    private readonly scheduleExpiry?: ExpiryScheduler,
  ) {}

  issue(request: PlaybackRequest, value: Value, binding: PlaybackConfirmationBinding): string {
    this.prune();
    while (this.pending.size >= this.maxEntries) {
      const oldest = this.pending.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.pending.delete(oldest);
    }

    let id = this.createId();
    while (this.pending.has(id)) id = this.createId();
    const sequence = ++this.nextSequence;
    const expiresAt = this.now() + this.ttlMs;
    const entry: PendingPlaybackConfirmation<Value> = {
      ...binding,
      sequence,
      requestFingerprint: fingerprintRequest(request),
      expiresAt,
      value,
    };
    this.pending.set(id, entry);
    this.scheduleExpiry?.(() => {
      const current = this.pending.get(id);
      if (current?.sequence === sequence && expiresAt <= this.now()) {
        this.pending.delete(id);
      }
    }, this.ttlMs + 1);
    return id;
  }

  consume(
    id: string,
    request: PlaybackRequest,
    current: { connectionGeneration: number; managedSequence: number },
  ): ConsumedPlaybackConfirmation<Value> | undefined {
    const entry = this.pending.get(id);
    if (entry === undefined) return undefined;
    this.pending.delete(id);

    if (
      entry.expiresAt <= this.now() ||
      entry.connectionGeneration !== current.connectionGeneration ||
      entry.requestFingerprint !== fingerprintRequest(request) ||
      (entry.managedSequence !== undefined && entry.managedSequence !== current.managedSequence)
    ) {
      return undefined;
    }

    return {
      value: entry.value,
      ...(entry.managedSequence === undefined ? {} : { managedSequence: entry.managedSequence }),
    };
  }

  clear(): void {
    this.pending.clear();
  }

  private prune(): void {
    const now = this.now();
    for (const [id, entry] of this.pending) {
      if (entry.expiresAt <= now) this.pending.delete(id);
    }
  }
}
