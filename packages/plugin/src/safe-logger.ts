import { redactSecrets, redactString } from '@iina-jellyfin/core';

type LogMethod = (message: string) => void;

export interface LogSink {
  log: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

const MAX_SERIALIZED_CONTEXT_CHARS = 16 * 1024;
const MAX_LOG_MESSAGE_CHARS = 4 * 1024;
const MAX_COLLECTION_ENTRIES = 100;
const MAX_CONTEXT_DEPTH = 8;

function scrubLocalPaths(value: string): string {
  return value.replace(/\/Users\/[^/\s"']+/g, '~');
}

function sanitizeMessage(message: string): string {
  const sanitized = scrubLocalPaths(redactString(message));
  if (sanitized.length <= MAX_LOG_MESSAGE_CHARS) return sanitized;
  return `${sanitized.slice(0, MAX_LOG_MESSAGE_CHARS)}…[TRUNCATED]`;
}

function normalizeLogValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') return scrubLocalPaths(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_CONTEXT_DEPTH) return '[MAX_DEPTH]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const candidate = value as Error & { code?: unknown; cause?: unknown };
    const normalized: Record<string, unknown> = {
      name: candidate.name,
      message: candidate.message,
    };
    if (typeof candidate.code === 'string' || typeof candidate.code === 'number') {
      normalized.code = candidate.code;
    }
    if (typeof candidate.stack === 'string') normalized.stack = scrubLocalPaths(candidate.stack);
    if (candidate.cause !== undefined) {
      normalized.cause = normalizeLogValue(candidate.cause, seen, depth + 1);
    }
    return normalized;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_ENTRIES)
      .map((item) => normalizeLogValue(item, seen, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_COLLECTION_ENTRIES)) {
    output[key] = normalizeLogValue(item, seen, depth + 1);
  }
  return output;
}

function serialize(value: unknown): string {
  if (typeof value === 'string') return scrubLocalPaths(redactString(value));
  try {
    const serialized = JSON.stringify(redactSecrets(normalizeLogValue(value)));
    if (serialized.length <= MAX_SERIALIZED_CONTEXT_CHARS) return serialized;
    return `${serialized.slice(0, MAX_SERIALIZED_CONTEXT_CHARS)}…[TRUNCATED]`;
  } catch {
    return '[unserializable]';
  }
}

export class SafeLogger {
  constructor(private readonly sink: LogSink) {}

  info(message: string, context?: unknown): void {
    const safeMessage = sanitizeMessage(message);
    this.sink.log(context === undefined ? safeMessage : `${safeMessage} ${serialize(context)}`);
  }

  warn(message: string, context?: unknown): void {
    const safeMessage = sanitizeMessage(message);
    this.sink.warn(context === undefined ? safeMessage : `${safeMessage} ${serialize(context)}`);
  }

  error(message: string, context?: unknown): void {
    const safeMessage = sanitizeMessage(message);
    this.sink.error(context === undefined ? safeMessage : `${safeMessage} ${serialize(context)}`);
  }
}
