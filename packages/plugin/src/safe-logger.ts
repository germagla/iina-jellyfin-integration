import { redactSecrets } from '@iina-jellyfin/core';

type LogMethod = (message: string) => void;

export interface LogSink {
  log: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

function serialize(value: unknown): string {
  if (typeof value === 'string') return String(redactSecrets(value));
  try {
    return JSON.stringify(redactSecrets(value));
  } catch {
    return '[unserializable]';
  }
}

export class SafeLogger {
  constructor(private readonly sink: LogSink) {}

  info(message: string, context?: unknown): void {
    this.sink.log(context === undefined ? message : `${message} ${serialize(context)}`);
  }

  warn(message: string, context?: unknown): void {
    this.sink.warn(context === undefined ? message : `${message} ${serialize(context)}`);
  }

  error(message: string, context?: unknown): void {
    this.sink.error(context === undefined ? message : `${message} ${serialize(context)}`);
  }
}
