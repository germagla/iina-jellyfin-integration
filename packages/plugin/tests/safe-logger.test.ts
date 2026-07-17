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

  it('redacts a secret embedded directly in the primary message', () => {
    const messages: string[] = [];
    const logger = new SafeLogger({
      log: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
    });

    logger.warn('Authorization: Bearer direct-message-secret');

    expect(messages).toEqual(['Authorization: Bearer [REDACTED]']);
  });

  it('preserves useful Error diagnostics without leaking secrets or local usernames', () => {
    const messages: string[] = [];
    const logger = new SafeLogger({
      log: (message) => messages.push(message),
      warn: (message) => messages.push(message),
      error: (message) => messages.push(message),
    });
    const error = new Error('Playback failed with ApiKey=secret-token');
    error.stack = `Error: Playback failed\n    at /Users/alice/project/global.ts:42:1`;

    logger.error('native-player.create.failed', error);

    expect(messages[0]).toContain('Playback failed');
    expect(messages[0]).toContain('global.ts:42:1');
    expect(messages[0]).toContain('[REDACTED]');
    expect(messages[0]).not.toContain('secret-token');
    expect(messages[0]).not.toContain('/Users/alice');
    expect(messages[0]?.endsWith('{}')).toBe(false);
  });
});
