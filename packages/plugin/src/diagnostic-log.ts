import {
  CATALOG_DIAGNOSTIC_KINDS,
  CATALOG_DIAGNOSTIC_MESSAGE_MAX_CHARS,
  CATALOG_DIAGNOSTIC_STACK_MAX_CHARS,
  redactString,
  type CatalogDiagnosticKind,
  type CatalogDiagnosticRecord,
} from '@iina-jellyfin/core';
import type { LogSink } from './safe-logger';

export const DIAGNOSTIC_LOG_PATH = '@data/jellyfin-diagnostics.log';
export const PREVIOUS_DIAGNOSTIC_LOG_PATH = '@data/jellyfin-diagnostics.previous.log';
export const MAX_DIAGNOSTIC_LOG_BYTES = 512 * 1024;
export const MAX_PLAYER_DIAGNOSTIC_GENERATIONS = 32;

const PLAYER_DIAGNOSTIC_FILE_PREFIX = 'jellyfin-player-diagnostics-';
const MAX_PLAYER_DIAGNOSTIC_ID_CHARS = 64;

const MAX_DIAGNOSTIC_MESSAGE_CHARS = 16 * 1024;
const MAX_APPEND_ATTEMPTS = 3;

export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface DiagnosticFileApi {
  exists(path: string): boolean;
  read(path: string): string | undefined;
  write(path: string, content: string): void;
  showInFinder(path: string): void;
  handle(path: string, mode: string): DiagnosticFileHandleApi;
}

export interface DiagnosticDirectoryApi {
  list(
    path: string,
    options: { includeSubDir: boolean },
  ): { filename: string; path: string; isDir: boolean }[];
  delete(path: string): void;
}

export interface DiagnosticLogPaths {
  current: string;
  previous: string;
}

export interface PlayerDiagnosticLogPaths extends DiagnosticLogPaths {
  generationId: string;
}

const DEFAULT_DIAGNOSTIC_LOG_PATHS: DiagnosticLogPaths = {
  current: DIAGNOSTIC_LOG_PATH,
  previous: PREVIOUS_DIAGNOSTIC_LOG_PATH,
};

export interface DiagnosticFileHandleApi {
  seekToEnd(): void;
  offset(): number;
  write(data: string): void;
  close(): void;
}

interface DiagnosticConsoleApi {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface ForwardedDiagnosticRecord {
  level: DiagnosticLevel;
  message: string;
}

function isCatalogDiagnosticKind(value: unknown): value is CatalogDiagnosticKind {
  return CATALOG_DIAGNOSTIC_KINDS.some((kind) => kind === value);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index += 1;
      bytes += 4;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function scrubLocalPaths(value: string): string {
  return value.replace(/\/Users\/[^/\s"']+/g, '~');
}

function safeDiagnosticMessage(value: string): string {
  const sanitized = scrubLocalPaths(redactString(value)).replace(
    /\bhttps?:\/\/[^\s"']+/gi,
    '[URL_REDACTED]',
  );
  if (sanitized.length <= MAX_DIAGNOSTIC_MESSAGE_CHARS) return sanitized;
  return `${sanitized.slice(0, MAX_DIAGNOSTIC_MESSAGE_CHARS)}…[TRUNCATED]`;
}

function safePlayerDiagnosticId(value: string): string {
  const safe = value
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_PLAYER_DIAGNOSTIC_ID_CHARS);
  return safe || 'player';
}

export function createPlayerDiagnosticLogPaths(generationId: string): PlayerDiagnosticLogPaths {
  const safeId = safePlayerDiagnosticId(generationId);
  const base = `@data/${PLAYER_DIAGNOSTIC_FILE_PREFIX}${safeId}`;
  return {
    generationId: safeId,
    current: `${base}.log`,
    previous: `${base}.previous.log`,
  };
}

/**
 * Retains only a conservative number of old player-log generations. The
 * strict filename match prevents this best-effort cleanup from deleting the
 * Global diagnostic files or any other plugin-private data.
 */
export function prunePlayerDiagnosticLogs(
  file: DiagnosticDirectoryApi,
  currentGenerationId: string,
  maxGenerations = MAX_PLAYER_DIAGNOSTIC_GENERATIONS,
): void {
  try {
    if (!Number.isSafeInteger(maxGenerations) || maxGenerations < 1) return;

    const pattern = new RegExp(
      `^${PLAYER_DIAGNOSTIC_FILE_PREFIX}([a-zA-Z0-9-]{1,${MAX_PLAYER_DIAGNOSTIC_ID_CHARS}})(?:\\.previous)?\\.log$`,
    );
    const filesByGeneration = new Map<string, string[]>();
    for (const entry of file.list('@data/', { includeSubDir: false })) {
      if (entry.isDir) continue;
      const match = pattern.exec(entry.filename);
      if (!match) continue;
      const generation = match[1];
      if (generation === undefined) continue;
      const paths = filesByGeneration.get(generation) ?? [];
      // Construct the plugin-private path from the validated filename instead
      // of trusting a path returned by the host.
      paths.push(`@data/${entry.filename}`);
      filesByGeneration.set(generation, paths);
    }

    const current = safePlayerDiagnosticId(currentGenerationId);
    const newestFirst = [...filesByGeneration.keys()].sort((left, right) =>
      right.localeCompare(left),
    );
    const retained = new Set<string>([current]);
    for (const generation of newestFirst) {
      if (retained.size >= maxGenerations) break;
      retained.add(generation);
    }

    for (const [generation, paths] of filesByGeneration) {
      if (retained.has(generation)) continue;
      for (const path of paths) {
        try {
          file.delete(path);
        } catch {
          // Cleanup is best-effort and must not interfere with playback.
        }
      }
    }
  } catch {
    // Listing may be unavailable or fail in a constrained IINA context.
  }
}

export function parseForwardedDiagnosticRecord(
  raw: unknown,
): ForwardedDiagnosticRecord | undefined {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const candidate = raw as Record<string, unknown>;
    const keys = Object.keys(candidate);
    if (
      keys.some((key) => key !== 'level' && key !== 'message') ||
      (candidate.level !== 'info' && candidate.level !== 'warn' && candidate.level !== 'error') ||
      typeof candidate.message !== 'string' ||
      candidate.message.length > MAX_DIAGNOSTIC_MESSAGE_CHARS
    ) {
      return undefined;
    }
    return { level: candidate.level, message: safeDiagnosticMessage(candidate.message) };
  } catch {
    return undefined;
  }
}

export function parseCatalogDiagnosticRecord(raw: unknown): CatalogDiagnosticRecord | undefined {
  try {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const candidate = raw as Record<string, unknown>;
    const keys = Object.keys(candidate);
    if (
      keys.some((key) => key !== 'kind' && key !== 'message' && key !== 'stack') ||
      !isCatalogDiagnosticKind(candidate.kind) ||
      typeof candidate.message !== 'string' ||
      candidate.message.length === 0 ||
      candidate.message.length > CATALOG_DIAGNOSTIC_MESSAGE_MAX_CHARS ||
      (candidate.stack !== undefined &&
        (typeof candidate.stack !== 'string' ||
          candidate.stack.length > CATALOG_DIAGNOSTIC_STACK_MAX_CHARS))
    ) {
      return undefined;
    }

    const record: CatalogDiagnosticRecord = {
      kind: candidate.kind,
      message: safeDiagnosticMessage(candidate.message),
    };
    if (typeof candidate.stack === 'string' && candidate.stack.length > 0) {
      record.stack = safeDiagnosticMessage(candidate.stack);
    }
    return record;
  } catch {
    return undefined;
  }
}

export class PersistentDiagnosticLog {
  private warnedAboutFailure = false;

  constructor(
    private readonly file: DiagnosticFileApi,
    private readonly onFailure: (message: string) => void = () => undefined,
    private readonly now: () => number = Date.now,
    private readonly maxBytes = MAX_DIAGNOSTIC_LOG_BYTES,
    private readonly paths: DiagnosticLogPaths = DEFAULT_DIAGNOSTIC_LOG_PATHS,
  ) {
    try {
      this.normalizeExistingFile(this.paths.current);
      this.normalizeExistingFile(this.paths.previous);
    } catch {
      this.reportFailureOnce();
    }
  }

  append(
    level: DiagnosticLevel,
    scope: 'global' | 'player',
    message: string,
    source?: string,
  ): void {
    try {
      const timestamp = new Date(this.now()).toISOString();
      const record: Record<string, string> = {
        timestamp,
        level,
        scope,
        message: safeDiagnosticMessage(message),
      };
      if (source !== undefined) record.source = safeDiagnosticMessage(source).slice(0, 128);
      const line = `${JSON.stringify(record)}\n`;
      const lineBytes = utf8ByteLength(line);

      // Repair a bound violation left by any interleaved writer even when the new
      // record itself is too large to append.
      this.normalizeExistingFile(this.paths.current);
      this.normalizeExistingFile(this.paths.previous);

      // A record that cannot fit by itself must not defeat the hard file-size bound.
      // Production records are already capped far below the default log limit; this
      // guard primarily protects custom limits and future schema growth.
      if (lineBytes > this.maxBytes) return;

      for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
        if (!this.file.exists(this.paths.current)) {
          this.file.write(this.paths.current, '');
        }

        const handle = this.file.handle(this.paths.current, 'write');
        let currentSize: number;
        try {
          // Consult the real EOF for every append. Player entries use isolated
          // paths, but this remains defensive against a host reload or two log
          // instances being configured with the same custom path.
          handle.seekToEnd();
          currentSize = handle.offset();
          if (
            Number.isSafeInteger(currentSize) &&
            currentSize >= 0 &&
            currentSize <= this.maxBytes &&
            currentSize + lineBytes <= this.maxBytes
          ) {
            handle.write(line);
          }
        } finally {
          handle.close();
        }

        if (!Number.isSafeInteger(currentSize) || currentSize < 0 || currentSize > this.maxBytes) {
          this.file.write(this.paths.current, '');
          continue;
        }

        if (currentSize + lineBytes > this.maxBytes) {
          this.rotateCurrentFile();
          continue;
        }

        // There is no atomic append primitive in IINA's synchronous File API.
        // Re-check with a fresh handle so an unexpected interleaved writer cannot
        // leave an oversized file behind. normalizeExistingFile clears an overflow,
        // and a retry then preserves this record in the newly bounded current file.
        const resultingSize = this.normalizeExistingFile(this.paths.current);
        this.normalizeExistingFile(this.paths.previous);
        if (resultingSize >= lineBytes) return;
      }

      // Keep both generations bounded even if another writer repeatedly races all
      // retry attempts. Diagnostics must never compromise plugin behavior.
      this.normalizeExistingFile(this.paths.current);
      this.normalizeExistingFile(this.paths.previous);
    } catch {
      this.reportFailureOnce();
    }
  }

  reveal(): void {
    try {
      if (!this.file.exists(this.paths.current)) {
        this.file.write(this.paths.current, '');
      }
      this.file.showInFinder(this.paths.current);
    } catch {
      this.reportFailureOnce();
    }
  }

  private normalizeExistingFile(path: string): number {
    if (!this.file.exists(path)) return 0;
    const handle = this.file.handle(path, 'read');
    let size: number;
    try {
      handle.seekToEnd();
      size = handle.offset();
    } finally {
      handle.close();
    }
    if (!Number.isSafeInteger(size) || size < 0 || size > this.maxBytes) {
      this.file.write(path, '');
      return 0;
    }
    return size;
  }

  private rotateCurrentFile(): void {
    const currentSize = this.normalizeExistingFile(this.paths.current);
    let current = currentSize > 0 ? (this.file.read(this.paths.current) ?? '') : '';
    if (utf8ByteLength(current) > this.maxBytes) current = '';
    this.file.write(this.paths.previous, current);
    this.file.write(this.paths.current, '');
    this.normalizeExistingFile(this.paths.previous);
    this.normalizeExistingFile(this.paths.current);
  }

  private reportFailureOnce(): void {
    if (this.warnedAboutFailure) return;
    this.warnedAboutFailure = true;
    try {
      this.onFailure('Jellyfin diagnostics could not be written to plugin-private storage.');
    } catch {
      // Diagnostics must never interfere with plugin behavior.
    }
  }
}

export function createGlobalDiagnosticSink(
  consoleApi: DiagnosticConsoleApi,
  diagnostics: PersistentDiagnosticLog,
): LogSink {
  const write = (level: DiagnosticLevel, message: string): void => {
    try {
      if (level === 'info') consoleApi.log(message);
      else if (level === 'warn') consoleApi.warn(message);
      else consoleApi.error(message);
    } catch {
      // The persistent sink remains useful if IINA's console is unavailable.
    }
    diagnostics.append(level, 'global', message);
  };
  return {
    log: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message),
  };
}

export function createPlayerDiagnosticSink(
  consoleApi: DiagnosticConsoleApi,
  forward: (record: ForwardedDiagnosticRecord) => void,
): LogSink {
  const write = (level: DiagnosticLevel, message: string): void => {
    const safeMessage = safeDiagnosticMessage(message);
    try {
      if (level === 'info') consoleApi.log(safeMessage);
      else if (level === 'warn') consoleApi.warn(safeMessage);
      else consoleApi.error(safeMessage);
    } catch {
      // Forwarding still provides diagnostics if IINA's player console is unavailable.
    }
    try {
      forward({ level, message: safeMessage });
    } catch {
      // IINA console logging remains available if the global entry is unavailable.
    }
  };
  return {
    log: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message),
  };
}

export { safeDiagnosticMessage, utf8ByteLength };
