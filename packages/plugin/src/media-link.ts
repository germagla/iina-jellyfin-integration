const MEDIA_LINK_PREFIX = 'null://jellyfin/';
const MAX_LINK_LENGTH = 4_096;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_TITLE_LENGTH = 512;
const MAX_REFERENCE_FILENAME_BYTES = 180;

export interface JellyfinMediaLink {
  serverId: string;
  itemId: string;
  title: string;
}

function validIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_IDENTIFIER_LENGTH &&
    !containsUnsafeDisplayCharacter(value)
  );
}

function containsUnsafeDisplayCharacter(value: string): boolean {
  return /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(value);
}

function normalizedTitle(value: string): string {
  const normalized = [...value]
    .map((character) => (containsUnsafeDisplayCharacter(character) ? ' ' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const title = [...normalized].slice(0, MAX_TITLE_LENGTH).join('');
  return title.length > 0 ? title : 'Jellyfin media';
}

export function normalizeJellyfinMediaTitle(value: string): string {
  return normalizedTitle(value);
}

function utf8Length(value: string): number {
  let length = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    length += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return length;
}

function truncateUtf8(value: string, maximumBytes: number): string {
  let result = '';
  let bytes = 0;
  for (const character of value) {
    const characterBytes = utf8Length(character);
    if (bytes + characterBytes > maximumBytes) break;
    result += character;
    bytes += characterBytes;
  }
  return result;
}

function referenceFilename(title: string): string {
  const safe = normalizedTitle(title)
    .normalize('NFC')
    .replace(/[\\/:]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim();
  const bounded = truncateUtf8(safe || 'Jellyfin media', MAX_REFERENCE_FILENAME_BYTES).trim();
  return bounded.length > 0 ? bounded : 'Jellyfin media';
}

function hash32(value: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function referenceDisambiguator(input: JellyfinMediaLink): string {
  const identity = `${input.serverId}\u0000${input.itemId}`;
  return `${hash32(identity, 0x811c9dc5)}${hash32(identity, 0x9e3779b9)}`;
}

/**
 * Builds the credential-free path that IINA may safely persist in History and
 * Open Recent. The real Jellyfin URL and authorization headers are installed
 * only from mpv's on_load hook.
 */
export function createJellyfinMediaLink(input: JellyfinMediaLink): string {
  if (!validIdentifier(input.serverId) || !validIdentifier(input.itemId)) {
    throw new TypeError('Invalid Jellyfin media link identifier.');
  }
  const prefix = `${MEDIA_LINK_PREFIX}${encodeURIComponent(input.serverId)}/${encodeURIComponent(input.itemId)}/`;
  const encodedTitle: string[] = [];
  let length = prefix.length;
  for (const character of normalizedTitle(input.title)) {
    const encoded = encodeURIComponent(character);
    if (length + encoded.length > MAX_LINK_LENGTH) break;
    encodedTitle.push(encoded);
    length += encoded.length;
  }
  if (encodedTitle.length === 0) throw new TypeError('Jellyfin media link is too long.');
  const link = `${prefix}${encodedTitle.join('')}`;
  return link;
}

export function parseJellyfinMediaLink(value: unknown): JellyfinMediaLink | undefined {
  if (
    typeof value !== 'string' ||
    value.length > MAX_LINK_LENGTH ||
    !value.startsWith(MEDIA_LINK_PREFIX)
  ) {
    return undefined;
  }
  const segments = value.slice(MEDIA_LINK_PREFIX.length).split('/');
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) return undefined;
  try {
    const serverId = decodeURIComponent(segments[0] as string);
    const itemId = decodeURIComponent(segments[1] as string);
    const title = decodeURIComponent(segments[2] as string);
    if (
      !validIdentifier(serverId) ||
      !validIdentifier(itemId) ||
      title.length === 0 ||
      [...title].length > MAX_TITLE_LENGTH ||
      containsUnsafeDisplayCharacter(title)
    ) {
      return undefined;
    }
    return { serverId, itemId, title };
  } catch {
    return undefined;
  }
}

export function isJellyfinMediaLink(value: unknown): boolean {
  return parseJellyfinMediaLink(value) !== undefined;
}

export interface JellyfinMediaReferenceFile {
  dataPath: string;
  document: string;
}

/** Produces a readable, identity-bound marker for IINA History and Open Recent. */
export function createJellyfinMediaReference(input: JellyfinMediaLink): JellyfinMediaReferenceFile {
  const document = createJellyfinMediaLink(input);
  const parsed = parseJellyfinMediaLink(document);
  if (parsed === undefined) throw new TypeError('Invalid Jellyfin media reference.');
  const filename = referenceFilename(parsed.title);
  return {
    dataPath: `@data/${filename} · jf-${referenceDisambiguator(parsed)}`,
    document,
  };
}

export function matchesJellyfinMediaReferencePath(
  path: unknown,
  dataRoot: unknown,
  input: JellyfinMediaLink,
): boolean {
  if (typeof path !== 'string' || typeof dataRoot !== 'string' || !path.startsWith('/')) {
    return false;
  }
  const root = dataRoot.replace(/\/+$/, '');
  if (root.length === 0 || !path.startsWith(`${root}/`)) return false;
  const relative = path.slice(root.length + 1);
  if (relative.length === 0 || relative.includes('/')) return false;
  const { dataPath } = createJellyfinMediaReference(input);
  return dataPath.slice('@data/'.length).normalize('NFC') === relative.normalize('NFC');
}
