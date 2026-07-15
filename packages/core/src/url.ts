export type HttpTransportPolicy = 'https' | 'local-http-warning' | 'remote-http-accepted';

export interface NormalizedServerAddress {
  url: string;
  origin: string;
  basePath: string;
  hostname: string;
  isLocal: boolean;
  policy: HttpTransportPolicy;
}

export type ServerUrlErrorCode =
  | 'EMPTY_URL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'URL_CREDENTIALS_NOT_ALLOWED'
  | 'URL_QUERY_NOT_ALLOWED'
  | 'INSECURE_REMOTE_SERVER';

export class ServerUrlError extends Error {
  readonly code: ServerUrlErrorCode;

  constructor(code: ServerUrlErrorCode, message: string) {
    super(message);
    this.name = 'ServerUrlError';
    this.code = code;
  }
}

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
}

function isPrivateIpv4(hostname: string): boolean {
  const pieces = hostname.split('.');
  if (pieces.length !== 4 || pieces.some((piece) => !/^\d{1,3}$/.test(piece))) return false;

  const octets = pieces.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  if (!hostname.includes(':')) return false;
  if (hostname === '::1' || hostname === '::') return true;

  const firstGroup = hostname.split(':')[0]?.toLowerCase() ?? '';
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true;
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true;

  const mappedIpv4 = hostname.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  return mappedIpv4 === undefined ? false : isPrivateIpv4(mappedIpv4);
}

export function isLocalHostname(hostname: string): boolean {
  const host = normalizedHostname(hostname);
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  );
}

function parseUserSuppliedUrl(input: string): URL {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ServerUrlError('EMPTY_URL', 'Enter a Jellyfin server URL');
  }

  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    throw new ServerUrlError('INVALID_URL', 'The Jellyfin server URL is not valid');
  }
}

export function normalizeServerUrl(
  input: string,
  options: { allowInsecureRemote?: boolean } = {},
): NormalizedServerAddress {
  const parsed = parseUserSuppliedUrl(input);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServerUrlError('UNSUPPORTED_PROTOCOL', 'Jellyfin servers must use HTTP or HTTPS');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new ServerUrlError(
      'URL_CREDENTIALS_NOT_ALLOWED',
      'Do not put credentials in the server URL',
    );
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new ServerUrlError(
      'URL_QUERY_NOT_ALLOWED',
      'The server URL cannot contain a query or fragment',
    );
  }

  const local = isLocalHostname(parsed.hostname);
  if (parsed.protocol === 'http:' && !local && options.allowInsecureRemote !== true) {
    throw new ServerUrlError(
      'INSECURE_REMOTE_SERVER',
      'Remote Jellyfin servers must use HTTPS unless insecure access is explicitly accepted',
    );
  }

  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
  const origin = parsed.origin;
  const url = `${origin}${path}`;
  const policy: HttpTransportPolicy =
    parsed.protocol === 'https:' ? 'https' : local ? 'local-http-warning' : 'remote-http-accepted';

  return {
    url,
    origin,
    basePath: path,
    hostname: normalizedHostname(parsed.hostname),
    isLocal: local,
    policy,
  };
}

export function joinJellyfinPath(baseUrl: string, apiPath: string): string {
  const normalized = normalizeServerUrl(baseUrl, { allowInsecureRemote: true });
  const suffix = apiPath.replace(/^\/+/, '');
  return suffix.length === 0 ? normalized.url : `${normalized.url}/${suffix}`;
}

export function resolveJellyfinUrl(baseUrl: string, returnedUrl: string): string {
  const value = returnedUrl.trim();
  const server = normalizeServerUrl(baseUrl, { allowInsecureRemote: true });
  let resolved: URL;
  try {
    if (/^https?:\/\//i.test(value) || value.startsWith('//')) {
      resolved = new URL(value, server.origin);
    } else {
      // Jellyfin commonly returns root-looking paths such as /Videos/..., but
      // they are relative to its configured reverse-proxy base path. Resolving
      // after removing leading slashes preserves that behavior while allowing
      // URL normalization to expose and reject dot-segment escapes.
      resolved = new URL(value.replace(/^\/+/, ''), `${server.url}/`);
    }
  } catch {
    throw new ServerUrlError('INVALID_URL', 'Jellyfin returned an invalid media URL');
  }

  const withinBasePath =
    server.basePath === '' ||
    resolved.pathname === server.basePath ||
    resolved.pathname.startsWith(`${server.basePath}/`);
  if (
    resolved.username !== '' ||
    resolved.password !== '' ||
    resolved.origin !== server.origin ||
    !withinBasePath
  ) {
    throw new ServerUrlError(
      'INVALID_URL',
      'Jellyfin returned a media URL outside the configured server address',
    );
  }
  return resolved.toString();
}
