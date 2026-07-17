import { describe, expect, it, vi } from 'vitest';
import {
  DIAGNOSTIC_LOG_PATH,
  PREVIOUS_DIAGNOSTIC_LOG_PATH,
  PersistentDiagnosticLog,
  createPlayerDiagnosticLogPaths,
  createPlayerDiagnosticSink,
  parseCatalogDiagnosticRecord,
  parseForwardedDiagnosticRecord,
  prunePlayerDiagnosticLogs,
  type DiagnosticDirectoryApi,
  type DiagnosticFileApi,
  utf8ByteLength,
} from '../src/diagnostic-log';

function createFileHarness(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const shown: string[] = [];
  const file: DiagnosticFileApi = {
    exists: (path) => files.has(path),
    read: (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error('missing file');
      return value;
    },
    write: (path, content) => files.set(path, content),
    showInFinder: (path) => shown.push(path),
    handle: (path) => ({
      seekToEnd: () => undefined,
      offset: () => utf8ByteLength(files.get(path) ?? ''),
      write: (data) => files.set(path, `${files.get(path) ?? ''}${data}`),
      close: () => undefined,
    }),
  };
  return { file, files, shown };
}

describe('persistent diagnostic log', () => {
  it('stores redacted NDJSON records and reveals only its fixed plugin-private path', () => {
    const harness = createFileHarness();
    const diagnostics = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => Date.parse('2026-07-16T17:30:00.000Z'),
    );

    diagnostics.append(
      'warn',
      'global',
      'request failed at /Users/alice/project via https://media.example/stream?ApiKey=secret-token Authorization: Bearer bearer-secret',
    );
    diagnostics.reveal();

    const stored = harness.files.get(DIAGNOSTIC_LOG_PATH) ?? '';
    expect(() => JSON.parse(stored.trim())).not.toThrow();
    expect(stored).toContain('2026-07-16T17:30:00.000Z');
    expect(stored).toContain('[REDACTED]');
    expect(stored).toContain('~/project');
    expect(stored).not.toContain('secret-token');
    expect(stored).not.toContain('bearer-secret');
    expect(stored).not.toContain('media.example');
    expect(stored).not.toContain('/Users/alice');
    expect(harness.shown).toEqual([DIAGNOSTIC_LOG_PATH]);
  });

  it('rotates bounded current content into one previous file', () => {
    const harness = createFileHarness();
    let now = Date.parse('2026-07-16T17:30:00.000Z');
    const diagnostics = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => now++,
      420,
    );

    diagnostics.append('info', 'global', `first-${'a'.repeat(250)}`);
    diagnostics.append('info', 'global', `second-${'b'.repeat(250)}`);

    expect(harness.files.get(PREVIOUS_DIAGNOSTIC_LOG_PATH)).toContain('first-');
    expect(harness.files.get(DIAGNOSTIC_LOG_PATH)).toContain('second-');
    expect(harness.files.get(DIAGNOSTIC_LOG_PATH)).not.toContain('first-');
  });

  it('uses configured paths for append, rotation, and reveal', () => {
    const harness = createFileHarness();
    const paths = createPlayerDiagnosticLogPaths('player-test-123');
    let now = Date.parse('2026-07-16T17:30:00.000Z');
    const diagnostics = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => now++,
      420,
      paths,
    );

    diagnostics.append('info', 'player', `first-${'a'.repeat(250)}`);
    diagnostics.append('info', 'player', `second-${'b'.repeat(250)}`);
    diagnostics.reveal();

    expect(harness.files.get(paths.previous)).toContain('first-');
    expect(harness.files.get(paths.current)).toContain('second-');
    expect(harness.files.has(DIAGNOSTIC_LOG_PATH)).toBe(false);
    expect(harness.shown).toEqual([paths.current]);
  });

  it('uses the actual EOF when two log instances append to the same files', () => {
    const harness = createFileHarness();
    let now = Date.parse('2026-07-16T17:30:00.000Z');
    const firstWriter = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => now++,
      420,
    );
    const secondWriter = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => now++,
      420,
    );

    firstWriter.append('info', 'global', `first-${'a'.repeat(250)}`);
    secondWriter.append('info', 'player', `second-${'b'.repeat(250)}`);

    const current = harness.files.get(DIAGNOSTIC_LOG_PATH) ?? '';
    const previous = harness.files.get(PREVIOUS_DIAGNOSTIC_LOG_PATH) ?? '';
    expect(utf8ByteLength(current)).toBeLessThanOrEqual(420);
    expect(utf8ByteLength(previous)).toBeLessThanOrEqual(420);
    expect(previous).toContain('first-');
    expect(current).toContain('second-');
  });

  it('does not write a record that is larger than the file limit', () => {
    const harness = createFileHarness();
    let now = Date.parse('2026-07-16T17:30:00.000Z');
    const diagnostics = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => now++,
      200,
    );

    diagnostics.append('info', 'global', 'small record');
    const before = harness.files.get(DIAGNOSTIC_LOG_PATH);
    diagnostics.append('error', 'global', 'x'.repeat(16 * 1024));

    expect(harness.files.get(DIAGNOSTIC_LOG_PATH)).toBe(before);
    expect(utf8ByteLength(harness.files.get(DIAGNOSTIC_LOG_PATH) ?? '')).toBeLessThanOrEqual(200);
    expect(
      utf8ByteLength(harness.files.get(PREVIOUS_DIAGNOSTIC_LOG_PATH) ?? ''),
    ).toBeLessThanOrEqual(200);
  });

  it('repairs an overflow caused by a writer interleaving after the EOF check', () => {
    const harness = createFileHarness();
    const originalHandle = harness.file.handle;
    let injectCompetingWrite = true;
    harness.file.handle = (path, mode) => {
      const handle = originalHandle(path, mode);
      return {
        ...handle,
        write: (data) => {
          if (path === DIAGNOSTIC_LOG_PATH && mode === 'write' && injectCompetingWrite) {
            injectCompetingWrite = false;
            harness.files.set(path, `${harness.files.get(path) ?? ''}${'c'.repeat(260)}`);
          }
          handle.write(data);
        },
      };
    };
    const diagnostics = new PersistentDiagnosticLog(
      harness.file,
      () => undefined,
      () => Date.parse('2026-07-16T17:30:00.000Z'),
      300,
    );

    diagnostics.append('warn', 'player', 'interleaved record');

    const current = harness.files.get(DIAGNOSTIC_LOG_PATH) ?? '';
    const previous = harness.files.get(PREVIOUS_DIAGNOSTIC_LOG_PATH) ?? '';
    expect(utf8ByteLength(current)).toBeLessThanOrEqual(300);
    expect(utf8ByteLength(previous)).toBeLessThanOrEqual(300);
    expect(current).toContain('interleaved record');
    expect(current).not.toContain('c'.repeat(260));
  });

  it('swallows storage failures and reports them only once', () => {
    const warning = vi.fn();
    const file: DiagnosticFileApi = {
      exists: () => false,
      read: () => '',
      write: () => {
        throw new Error('disk unavailable');
      },
      showInFinder: () => {
        throw new Error('finder unavailable');
      },
      handle: () => {
        throw new Error('handle unavailable');
      },
    };
    const diagnostics = new PersistentDiagnosticLog(file, warning);

    expect(() => diagnostics.append('error', 'global', 'failure')).not.toThrow();
    expect(() => diagnostics.reveal()).not.toThrow();
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('discards oversized current and previous files without reading them into memory', () => {
    const harness = createFileHarness({
      [DIAGNOSTIC_LOG_PATH]: 'x'.repeat(500),
      [PREVIOUS_DIAGNOSTIC_LOG_PATH]: 'y'.repeat(500),
    });
    const read = vi.spyOn(harness.file, 'read');

    new PersistentDiagnosticLog(harness.file, () => undefined, Date.now, 420);

    expect(read).not.toHaveBeenCalled();
    expect(harness.files.get(DIAGNOSTIC_LOG_PATH)).toBe('');
    expect(harness.files.get(PREVIOUS_DIAGNOSTIC_LOG_PATH)).toBe('');
  });
});

describe('player diagnostic log generations', () => {
  it('creates bounded plugin-private paths from a hostile identifier', () => {
    const paths = createPlayerDiagnosticLogPaths(`../../Player ! ${'x'.repeat(100)}`);

    expect(paths.generationId).toMatch(/^[a-zA-Z0-9-]{1,64}$/);
    expect(paths.current).toBe(`@data/jellyfin-player-diagnostics-${paths.generationId}.log`);
    expect(paths.previous).toBe(
      `@data/jellyfin-player-diagnostics-${paths.generationId}.previous.log`,
    );
    expect(paths.current).not.toContain('../');
  });

  it('keeps the current and newest player generations without deleting global logs', () => {
    const filenames = [
      'jellyfin-diagnostics.log',
      'jellyfin-diagnostics.previous.log',
      'artwork-cache.json',
      ...Array.from({ length: 6 }, (_, index) => [
        `jellyfin-player-diagnostics-player-00${index}.log`,
        `jellyfin-player-diagnostics-player-00${index}.previous.log`,
      ]).flat(),
    ];
    const deleted: string[] = [];
    const directory: DiagnosticDirectoryApi = {
      list: (path, options) => {
        expect(path).toBe('@data/');
        expect(options).toEqual({ includeSubDir: false });
        return filenames.map((filename) => ({
          filename,
          path: `/untrusted/${filename}`,
          isDir: false,
        }));
      },
      delete: (path) => deleted.push(path),
    };

    prunePlayerDiagnosticLogs(directory, 'player-000', 3);

    expect(deleted).toHaveLength(6);
    expect(deleted).toEqual(
      expect.arrayContaining([
        '@data/jellyfin-player-diagnostics-player-001.log',
        '@data/jellyfin-player-diagnostics-player-001.previous.log',
        '@data/jellyfin-player-diagnostics-player-002.log',
        '@data/jellyfin-player-diagnostics-player-002.previous.log',
        '@data/jellyfin-player-diagnostics-player-003.log',
        '@data/jellyfin-player-diagnostics-player-003.previous.log',
      ]),
    );
    expect(deleted.join('\n')).not.toContain('jellyfin-diagnostics.log');
    expect(deleted.join('\n')).not.toContain('/untrusted/');
  });

  it('swallows directory listing and individual cleanup failures', () => {
    expect(() =>
      prunePlayerDiagnosticLogs(
        {
          list: () => {
            throw new Error('listing unavailable');
          },
          delete: () => undefined,
        },
        'player-current',
      ),
    ).not.toThrow();

    expect(() =>
      prunePlayerDiagnosticLogs(
        {
          list: () => [
            {
              filename: 'jellyfin-player-diagnostics-player-old.log',
              path: '/untrusted/old',
              isDir: false,
            },
          ],
          delete: () => {
            throw new Error('delete unavailable');
          },
        },
        'player-current',
        1,
      ),
    ).not.toThrow();
  });
});

describe('forwarded player diagnostics', () => {
  it('accepts only the narrow bounded record shape', () => {
    expect(parseForwardedDiagnosticRecord({ level: 'warn', message: 'media failed' })).toEqual({
      level: 'warn',
      message: 'media failed',
    });
    expect(
      parseForwardedDiagnosticRecord({ level: 'warn', message: 'media failed', token: 'secret' }),
    ).toBeUndefined();
    expect(
      parseForwardedDiagnosticRecord({ level: 'debug', message: 'media failed' }),
    ).toBeUndefined();
    expect(
      parseForwardedDiagnosticRecord({ level: 'info', message: 'x'.repeat(16 * 1024 + 1) }),
    ).toBeUndefined();
    const hostile = Object.create(null, {
      level: { get: () => 'warn', enumerable: true },
      message: {
        get: () => {
          throw new Error('hostile getter');
        },
        enumerable: true,
      },
    });
    expect(() => parseForwardedDiagnosticRecord(hostile)).not.toThrow();
    expect(parseForwardedDiagnosticRecord(hostile)).toBeUndefined();
  });

  it('redacts again before forwarding and keeps console fallback', () => {
    const forwarded: unknown[] = [];
    const consoleApi = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const sink = createPlayerDiagnosticSink(consoleApi, (record) => forwarded.push(record));

    sink.warn('Authorization: Bearer player-secret');

    expect(consoleApi.warn).toHaveBeenCalledWith('Authorization: Bearer [REDACTED]');
    expect(JSON.stringify(forwarded)).not.toContain('player-secret');
  });
});

describe('catalog webview diagnostics', () => {
  it('accepts only the narrow bounded catalog record', () => {
    expect(
      parseCatalogDiagnosticRecord({
        kind: 'react-render',
        message: 'Catalog render failed',
        stack: 'at CatalogApp',
      }),
    ).toEqual({
      kind: 'react-render',
      message: 'Catalog render failed',
      stack: 'at CatalogApp',
    });
    expect(
      parseCatalogDiagnosticRecord({
        kind: 'react-render',
        message: 'Catalog render failed',
        accessToken: 'secret',
      }),
    ).toBeUndefined();
    expect(
      parseCatalogDiagnosticRecord({ kind: 'other', message: 'Catalog render failed' }),
    ).toBeUndefined();
    expect(
      parseCatalogDiagnosticRecord({ kind: 'bootstrap', message: 'x'.repeat(1_025) }),
    ).toBeUndefined();
    expect(
      parseCatalogDiagnosticRecord({
        kind: 'bootstrap',
        message: 'Catalog failed',
        stack: 'x'.repeat(4_097),
      }),
    ).toBeUndefined();
  });

  it('redacts secrets, server URLs, and local usernames before native logging', () => {
    const record = parseCatalogDiagnosticRecord({
      kind: 'window-error',
      message:
        'Authorization: Bearer catalog-secret at https://media.example/items?ApiKey=query-secret',
      stack: 'at /Users/alice/project/catalog.tsx:20:4',
    });

    expect(JSON.stringify(record)).toContain('[REDACTED]');
    expect(JSON.stringify(record)).not.toContain('catalog-secret');
    expect(JSON.stringify(record)).not.toContain('query-secret');
    expect(JSON.stringify(record)).not.toContain('media.example');
    expect(JSON.stringify(record)).not.toContain('/Users/alice');
  });

  it('does not throw when an untrusted record has hostile property access', () => {
    const hostile = Object.create(null, {
      kind: { value: 'bootstrap', enumerable: true },
      message: {
        get: () => {
          throw new Error('hostile getter');
        },
        enumerable: true,
      },
    });

    expect(() => parseCatalogDiagnosticRecord(hostile)).not.toThrow();
    expect(parseCatalogDiagnosticRecord(hostile)).toBeUndefined();
  });
});
