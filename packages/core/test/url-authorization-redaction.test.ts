import { describe, expect, it } from 'vitest';

import { createMediaBrowserAuthorization } from '../src/authorization';
import { redactSecrets, redactString, REDACTED } from '../src/redaction';
import {
  isLocalHostname,
  joinJellyfinPath,
  normalizeServerUrl,
  resolveJellyfinUrl,
  ServerUrlError,
} from '../src/url';

describe('server URL handling', () => {
  it('preserves reverse-proxy base paths and ports', () => {
    expect(normalizeServerUrl('https://media.example:8443/jellyfin/')).toMatchObject({
      url: 'https://media.example:8443/jellyfin',
      origin: 'https://media.example:8443',
      basePath: '/jellyfin',
      policy: 'https',
    });
    expect(joinJellyfinPath('https://media.example/jellyfin/', '/System/Info/Public')).toBe(
      'https://media.example/jellyfin/System/Info/Public',
    );
  });

  it('defaults missing schemes to HTTPS', () => {
    expect(normalizeServerUrl('media.example/jellyfin').url).toBe('https://media.example/jellyfin');
  });

  it('allows local HTTP with a warning but requires an explicit remote exception', () => {
    expect(normalizeServerUrl('http://192.168.1.20:8096').policy).toBe('local-http-warning');
    expect(() => normalizeServerUrl('http://media.example:8096')).toThrowError(ServerUrlError);
    expect(
      normalizeServerUrl('http://media.example:8096', { allowInsecureRemote: true }).policy,
    ).toBe('remote-http-accepted');
  });

  it('recognizes common LAN and loopback names', () => {
    expect(isLocalHostname('localhost')).toBe(true);
    expect(isLocalHostname('jellyfin.local')).toBe(true);
    expect(isLocalHostname('10.0.0.2')).toBe(true);
    expect(isLocalHostname('172.31.20.4')).toBe(true);
    expect(isLocalHostname('[::1]')).toBe(true);
    expect(isLocalHostname('media.example')).toBe(false);
  });

  it('rejects credentials, queries, and non-HTTP protocols', () => {
    expect(() => normalizeServerUrl('https://user:pw@media.example')).toThrow();
    expect(() => normalizeServerUrl('https://media.example?api_key=secret')).toThrow();
    expect(() => normalizeServerUrl('file:///tmp/media')).toThrow();
  });

  it('rejects server-returned media URLs that could leak headers to another origin', () => {
    expect(() =>
      resolveJellyfinUrl('https://media.example/jellyfin', 'https://attacker.example/stream'),
    ).toThrow();
    expect(() =>
      resolveJellyfinUrl(
        'https://media.example/jellyfin',
        'https://media.example/other/stream?api_key=secret',
      ),
    ).toThrow();
    expect(() =>
      resolveJellyfinUrl(
        'https://media.example/jellyfin',
        'https://user:password@media.example/jellyfin/stream',
      ),
    ).toThrow();
    expect(() =>
      resolveJellyfinUrl('https://media.example/jellyfin', '../outside/stream'),
    ).toThrow();
    expect(() =>
      resolveJellyfinUrl('https://media.example/jellyfin', '%2e%2e/outside/stream'),
    ).toThrow();
    expect(() =>
      resolveJellyfinUrl('https://media.example/jellyfin', '//attacker.example/stream'),
    ).toThrow();
  });

  it('resolves returned media paths inside a reverse-proxy base path', () => {
    expect(
      resolveJellyfinUrl(
        'https://media.example/jellyfin',
        '/Videos/movie/stream.m3u8?api_key=secret',
      ),
    ).toBe('https://media.example/jellyfin/Videos/movie/stream.m3u8?api_key=secret');
  });
});

describe('MediaBrowser authorization', () => {
  it('builds the current Jellyfin Authorization header', () => {
    expect(
      createMediaBrowserAuthorization({
        client: 'Jellyfin for IINA',
        device: 'IINA',
        deviceId: 'stable-device-id',
        version: '0.1.0',
        accessToken: 'token-value',
      }),
    ).toBe(
      'MediaBrowser Client="Jellyfin for IINA", Device="IINA", DeviceId="stable-device-id", Version="0.1.0", Token="token-value"',
    );
  });

  it('omits the token before authentication and blocks header injection', () => {
    expect(
      createMediaBrowserAuthorization({
        client: 'Jellyfin for IINA',
        device: 'IINA',
        deviceId: 'device',
        version: '0.1.0',
      }),
    ).not.toContain('Token=');
    expect(() =>
      createMediaBrowserAuthorization({
        client: 'Jellyfin for IINA\r\nInjected: true',
        device: 'IINA',
        deviceId: 'device',
        version: '0.1.0',
      }),
    ).toThrow();
  });
});

describe('secret redaction', () => {
  it('deeply redacts headers, credentials, and URL query secrets without mutating input', () => {
    const original = {
      headers: { Authorization: 'MediaBrowser Token="abc"', Accept: 'application/json' },
      nested: [
        { password: 'hunter2' },
        { url: 'https://media.example/video?api_key=abc&quality=8' },
      ],
    };
    const redacted = redactSecrets(original);

    expect(redacted.headers.Authorization).toBe(REDACTED);
    expect(redacted.nested[0]?.password).toBe(REDACTED);
    expect(new URL(redacted.nested[1]?.url ?? '').searchParams.get('api_key')).toBe(REDACTED);
    expect(original.headers.Authorization).toContain('abc');
    expect(original.nested[0]?.password).toBe('hunter2');
  });

  it('redacts tokens embedded in log strings', () => {
    expect(redactString('GET /stream?api_key=abc123&x=1')).not.toContain('abc123');
    expect(redactString('MediaBrowser Client="IINA", Token="abc123"')).not.toContain('abc123');
    expect(redactString('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
    expect(redactString('Authorization: Basic dXNlcjpwYXNzd29yZA==')).not.toContain(
      'dXNlcjpwYXNzd29yZA==',
    );
    expect(redactString('https://user:password@media.example/video')).not.toContain('password');
  });
});
