import { describe, expect, it } from 'vitest';
import { SafeLogger } from '../src/safe-logger';

describe('SafeLogger', () => {
  it('redacts headers and query credentials from all sinks', () => {
    const messages: string[] = [];
    const logger = new SafeLogger({
      log: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
    });
    logger.warn('request', {
      Authorization: 'MediaBrowser Token="secret-token"',
      url: 'https://media.test/master.m3u8?ApiKey=secret-token',
    });

    expect(messages.join(' ')).not.toContain('secret-token');
    expect(messages.join(' ')).toContain('[REDACTED]');
  });
});
