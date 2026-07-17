import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

describe('bare JavaScriptCore compatibility', () => {
  it('normalizes, validates, queries, resolves, and redacts URLs without Web URL globals', async () => {
    const root = path.resolve(import.meta.dirname, '../../..');
    const result = await build({
      absWorkingDir: root,
      stdin: {
        resolveDir: root,
        sourcefile: 'javascriptcore-compat-entry.ts',
        loader: 'ts',
        contents: `
          import {
            ConnectionMetadataSchema,
            PlaybackPlanSchema,
            buildCatalogRequest,
            normalizeServerUrl,
            redactString,
            resolveJellyfinUrl,
          } from './packages/core/src/index.ts';
          import {
            DIAGNOSTIC_LOG_PATH,
            PersistentDiagnosticLog,
            createGlobalDiagnosticSink,
          } from './packages/plugin/src/diagnostic-log.ts';
          import { SafeLogger } from './packages/plugin/src/safe-logger.ts';

          const address = normalizeServerUrl('localhost:8096/jellyfin/');
          const ipv6Address = normalizeServerUrl('[::1]:8096');
          const metadata = ConnectionMetadataSchema.parse({
            schemaVersion: 1,
            serverUrl: address.url,
            serverId: 'server-1',
            serverName: 'Local Jellyfin',
            userId: 'user-1',
            username: 'alex',
            deviceId: 'device-1',
            acceptedInsecureRemote: false,
            lastConnectedAt: '2026-07-15T00:00:00.000Z',
          });
          const catalog = buildCatalogRequest(
            {
              kind: 'search',
              query: 'A B',
              includeItemTypes: ['Movie', 'Series'],
              startIndex: 0,
              limit: 40,
            },
            {
              serverUrl: address.url,
              userId: metadata.userId,
              accessToken: 'memory-only-token',
              deviceId: metadata.deviceId,
              version: '0.1.1',
            },
          );
          const unsafePlaybackUrl = resolveJellyfinUrl(
            address.url,
            '/Videos/movie-1/master.m3u8?ApiKey=secret',
          );
          const playbackInput = {
            itemId: 'movie-1',
            playSessionId: 'session-1',
            mediaSourceId: 'source-1',
            url: resolveJellyfinUrl(address.url, '/Videos/movie-1/master.m3u8?Static=true'),
            headers: {},
            playMethod: 'DirectStream',
            conversion: 'container',
            requiresVideoTranscodeConfirmation: false,
            transcodeReasons: [],
            startPositionTicks: 0,
          };
          const playback = PlaybackPlanSchema.parse(playbackInput);
          const unsafePlanAccepted = PlaybackPlanSchema.safeParse({
            ...playbackInput,
            url: unsafePlaybackUrl,
          }).success;
          const diagnosticFiles = {};
          const diagnosticFile = {
            exists: (path) => Object.prototype.hasOwnProperty.call(diagnosticFiles, path),
            read: (path) => diagnosticFiles[path],
            write: (path, content) => { diagnosticFiles[path] = content; },
            showInFinder: () => undefined,
            handle: (path) => ({
              seekToEnd: () => undefined,
              offset: () => (diagnosticFiles[path] || '').length,
              write: (data) => { diagnosticFiles[path] = (diagnosticFiles[path] || '') + data; },
              close: () => undefined,
            }),
          };
          const diagnostics = new PersistentDiagnosticLog(
            diagnosticFile,
            () => undefined,
            () => 1_800_000_000_000,
          );
          const logger = new SafeLogger(
            createGlobalDiagnosticSink(
              { log: () => undefined, warn: () => undefined, error: () => undefined },
              diagnostics,
            ),
          );
          logger.warn('Authorization: Bearer jsc-secret');

          globalThis.__compatResult = {
            address,
            ipv6Url: ipv6Address.url,
            catalogUrl: catalog.url,
            playbackUrl: playback.url,
            unsafePlanAccepted,
            redacted: redactString(unsafePlaybackUrl),
            diagnosticLog: diagnosticFiles[DIAGNOSTIC_LOG_PATH],
          };
        `,
      },
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['safari14.1'],
      write: false,
    });

    const output = result.outputFiles[0]?.text;
    expect(output).toBeDefined();
    const sandbox = {};
    runInNewContext('Array.prototype.at = undefined', sandbox);
    expect(runInNewContext('typeof URL', sandbox)).toBe('undefined');
    expect(runInNewContext('typeof URLSearchParams', sandbox)).toBe('undefined');
    runInNewContext(output, sandbox);

    expect(sandbox.__compatResult).toMatchObject({
      address: {
        url: 'http://localhost:8096/jellyfin',
        policy: 'local-http-warning',
        isLocal: true,
      },
      ipv6Url: 'http://[::1]:8096',
      playbackUrl: 'http://localhost:8096/jellyfin/Videos/movie-1/master.m3u8?Static=true',
      unsafePlanAccepted: false,
    });
    expect(sandbox.__compatResult.catalogUrl).toContain('SearchTerm=A+B');
    expect(sandbox.__compatResult.redacted).not.toContain('secret');
    expect(sandbox.__compatResult.diagnosticLog).toContain('[REDACTED]');
    expect(sandbox.__compatResult.diagnosticLog).not.toContain('jsc-secret');
  });
});
