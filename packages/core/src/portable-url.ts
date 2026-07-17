import {
  normalize as normalizeUri,
  parse as parseUri,
  resolve as resolveUri,
  serialize as serializeUri,
  type URIComponents,
} from 'uri-js';

export interface PortableUrl {
  scheme: string;
  userinfo: string | undefined;
  hostname: string;
  port: number | undefined;
  pathname: string;
  query: string | undefined;
  fragment: string | undefined;
  origin: string;
  href: string;
}

export type QueryValue = string | number | boolean | undefined;
type AbsoluteComponents = URIComponents & { scheme: string; host: string; path: string };

function containsUrlWhitespaceOrControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

function hasValidRawAuthority(input: string): boolean {
  const authorityStart = input.indexOf('://') + 3;
  const remainder = input.slice(authorityStart);
  const boundary = remainder.search(/[/?#]/);
  const authority = boundary === -1 ? remainder : remainder.slice(0, boundary);
  if (authority.length === 0) return false;

  const hostAndPort = authority.slice(authority.lastIndexOf('@') + 1);
  if (hostAndPort.startsWith('[')) {
    const closingBracket = hostAndPort.indexOf(']');
    if (closingBracket <= 1) return false;
    const suffix = hostAndPort.slice(closingBracket + 1);
    if (suffix === '') return true;
    if (!/^:\d+$/.test(suffix)) return false;
    const port = Number(suffix.slice(1));
    return Number.isInteger(port) && port >= 0 && port <= 65_535;
  }

  const separator = hostAndPort.lastIndexOf(':');
  if (separator === -1) return hostAndPort.length > 0;
  if (hostAndPort.indexOf(':') !== separator) return false;
  const hostname = hostAndPort.slice(0, separator);
  const portText = hostAndPort.slice(separator + 1);
  if (hostname.length === 0 || !/^\d+$/.test(portText)) return false;
  const port = Number(portText);
  return Number.isInteger(port) && port >= 0 && port <= 65_535;
}

function isValidIpv4(hostname: string): boolean {
  const octets = hostname.split('.');
  return (
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255)
  );
}

function isValidIpv6(hostname: string): boolean {
  const zoneIndex = hostname.indexOf('%');
  const address = zoneIndex === -1 ? hostname : hostname.slice(0, zoneIndex);
  const zone = zoneIndex === -1 ? undefined : hostname.slice(zoneIndex + 1);
  if (zone !== undefined && !/^[A-Za-z0-9_.-]+$/.test(zone)) return false;
  if (!/^[0-9A-Fa-f:.]+$/.test(address) || !address.includes(':')) return false;
  if ((address.match(/::/g) ?? []).length > 1) return false;

  let groups = address.split(':');
  const last = groups[groups.length - 1];
  if (last?.includes('.')) {
    if (!isValidIpv4(last)) return false;
    groups = [...groups.slice(0, -1), '0', '0'];
  }

  const populated = groups.filter((group) => group.length > 0);
  if (populated.some((group) => !/^[0-9A-Fa-f]{1,4}$/.test(group))) return false;
  return address.includes('::') ? populated.length < 8 : populated.length === 8;
}

function isValidHostname(hostname: string): boolean {
  if (hostname.includes(':')) return isValidIpv6(hostname);
  if (/^\d+(?:\.\d+){3}$/.test(hostname)) return isValidIpv4(hostname);

  const withoutFinalDot = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
  if (withoutFinalDot.length === 0 || withoutFinalDot.length > 253) return false;
  return withoutFinalDot.split('.').every((label) => {
    if (label.length === 0 || label.length > 63) return false;
    return /^[A-Za-z0-9_](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/.test(label);
  });
}

function uriComponents(value: PortableUrl): URIComponents {
  const components: URIComponents = {
    scheme: value.scheme,
    host: value.hostname,
    path: value.pathname,
  };
  if (value.userinfo !== undefined) components.userinfo = value.userinfo;
  if (value.port !== undefined) components.port = value.port;
  if (value.query !== undefined) components.query = value.query;
  if (value.fragment !== undefined) components.fragment = value.fragment;
  return components;
}

function originFromComponents(components: AbsoluteComponents): string {
  const origin = serializeUri({
    scheme: components.scheme,
    host: components.host,
    ...(components.port === undefined ? {} : { port: components.port }),
    path: '',
  });
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

/**
 * Parses an absolute hierarchical URL without relying on browser Web APIs.
 * IINA plugin entries run in a bare JavaScriptCore context where URL is absent.
 */
export function parseAbsoluteUrl(input: string): PortableUrl {
  if (typeof input !== 'string' || input.length === 0 || containsUrlWhitespaceOrControl(input)) {
    throw new TypeError('Invalid URL');
  }
  if (!/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(input)) throw new TypeError('Invalid URL');
  if (!hasValidRawAuthority(input)) throw new TypeError('Invalid URL');

  const normalized = normalizeUri(input);
  const components = parseUri(normalized);
  if (
    components.error !== undefined ||
    components.scheme === undefined ||
    components.host === undefined ||
    components.host.length === 0 ||
    !isValidHostname(components.host) ||
    components.port === ''
  ) {
    throw new TypeError('Invalid URL');
  }

  const port = components.port === undefined ? undefined : Number(components.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65_535)) {
    throw new TypeError('Invalid URL');
  }

  const canonical: AbsoluteComponents = {
    scheme: components.scheme.toLowerCase(),
    host: components.host.toLowerCase(),
    path: components.path ?? '',
  };
  if (components.userinfo !== undefined) canonical.userinfo = components.userinfo;
  if (port !== undefined) canonical.port = port;
  if (components.query !== undefined) canonical.query = components.query;
  if (components.fragment !== undefined) canonical.fragment = components.fragment;

  const href = serializeUri(canonical);
  return {
    scheme: canonical.scheme,
    userinfo: canonical.userinfo,
    hostname: canonical.host,
    port,
    pathname: canonical.path ?? '',
    query: canonical.query,
    fragment: canonical.fragment,
    origin: originFromComponents(canonical),
    href,
  };
}

export function resolveAbsoluteUrl(baseUrl: string, reference: string): PortableUrl {
  if (containsUrlWhitespaceOrControl(reference)) throw new TypeError('Invalid URL');
  const base = parseAbsoluteUrl(baseUrl);
  if (/^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(reference)) return parseAbsoluteUrl(reference);
  if (reference.startsWith('//') && !hasValidRawAuthority(`${base.scheme}:${reference}`)) {
    throw new TypeError('Invalid URL');
  }
  return parseAbsoluteUrl(resolveUri(base.href, reference));
}

export function serializeAbsoluteUrl(value: PortableUrl): string {
  return serializeUri(uriComponents(value));
}

function encodeQueryComponent(value: string): string {
  let scalarValue = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        scalarValue += value.charAt(index) + value.charAt(index + 1);
        index += 1;
      } else {
        scalarValue += '\uFFFD';
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      scalarValue += '\uFFFD';
    } else {
      scalarValue += value.charAt(index);
    }
  }
  return encodeURIComponent(scalarValue).replace(/%20/g, '+');
}

function decodeQueryComponent(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value.replace(/\+/g, ' ');
  }
}

export function queryEntries(query: string | undefined): Array<[string, string]> {
  if (query === undefined || query.length === 0) return [];
  return query.split('&').map((entry) => {
    const separator = entry.indexOf('=');
    if (separator === -1) return [decodeQueryComponent(entry), ''];
    return [
      decodeQueryComponent(entry.slice(0, separator)),
      decodeQueryComponent(entry.slice(separator + 1)),
    ];
  });
}

/**
 * Returns whether a query parameter name is likely to carry an authentication
 * credential. Jellyfin has used multiple spellings across generated media URLs
 * (for example ApiKey, api_key, access_token, and X-Emby-Token), so compare a
 * punctuation-insensitive form and conservatively reject other token/password/
 * secret suffixes as well.
 */
export function isSecretQueryParameterName(name: string): boolean {
  let decoded = name;
  for (let depth = 0; depth < 3; depth += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded.replace(/\+/g, ' '));
    } catch {
      break;
    }
    if (next === decoded) break;
    decoded = next;
  }
  const normalized = decoded.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized === 'apikey' ||
    normalized === 'passwd' ||
    normalized === 'pw' ||
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('secretkey')
  );
}

/**
 * Checks an absolute URL for credentials carried in its query string. Invalid
 * URLs return false so callers can retain their more specific URL-validation
 * errors; this function is a credential check, not a general parser.
 */
export function hasSecretQueryParameter(value: string): boolean {
  try {
    return queryEntries(parseAbsoluteUrl(value).query).some(([name]) =>
      isSecretQueryParameterName(name),
    );
  } catch {
    return false;
  }
}

export function encodeQueryEntries(entries: ReadonlyArray<readonly [string, string]>): string {
  return entries
    .map(([name, value]) => `${encodeQueryComponent(name)}=${encodeQueryComponent(value)}`)
    .join('&');
}

export function encodeQuery(values: Record<string, QueryValue>): string {
  return encodeQueryEntries(
    Object.entries(values).flatMap(([name, value]) =>
      value === undefined ? [] : ([[name, String(value)]] as const),
    ),
  );
}

export function queryValueCaseInsensitive(url: string, name: string): string | undefined {
  const wanted = name.toLowerCase();
  const parsed = parseUri(url);
  if (parsed.error !== undefined) return undefined;
  return queryEntries(parsed.query).find(([entryName]) => entryName.toLowerCase() === wanted)?.[1];
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = parseAbsoluteUrl(value);
    return parsed.scheme === 'http' || parsed.scheme === 'https';
  } catch {
    return false;
  }
}
