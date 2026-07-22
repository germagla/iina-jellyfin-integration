import { describe, expect, it } from 'vitest';
import {
  createJellyfinMediaReference,
  createJellyfinMediaLink,
  isJellyfinMediaLink,
  matchesJellyfinMediaReferencePath,
  normalizeJellyfinMediaTitle,
  parseJellyfinMediaLink,
} from '../src/media-link';

describe('Jellyfin media links', () => {
  it('round-trips a legacy credential-free media locator', () => {
    const link = createJellyfinMediaLink({
      serverId: 'server/one',
      itemId: 'episode?one',
      title: "Widow's Bay — S01E01 — Welcome!",
    });

    expect(link).toBe(
      "null://jellyfin/server%2Fone/episode%3Fone/Widow's%20Bay%20%E2%80%94%20S01E01%20%E2%80%94%20Welcome!",
    );
    expect(link).not.toContain('ApiKey');
    expect(link).not.toContain('Token');
    expect(parseJellyfinMediaLink(link)).toEqual({
      serverId: 'server/one',
      itemId: 'episode?one',
      title: "Widow's Bay — S01E01 — Welcome!",
    });
  });

  it('normalizes hostile display text without allowing path or control injection', () => {
    const link = createJellyfinMediaLink({
      serverId: 'server',
      itemId: 'item',
      title: ' Episode\n/../../next\u0000\u202Eevil\u2066\u0085 ',
    });

    expect(link).toBe('null://jellyfin/server/item/Episode%20%2F..%2F..%2Fnext%20evil');
    expect(parseJellyfinMediaLink(link)?.title).toBe('Episode /../../next evil');
    expect(normalizeJellyfinMediaTitle('Episode\n\u202Eevil')).toBe('Episode evil');
  });

  it('truncates titles without splitting Unicode characters', () => {
    const title = `${'a'.repeat(511)}😀trailing`;
    const link = createJellyfinMediaLink({ serverId: 'server', itemId: 'item', title });

    expect(parseJellyfinMediaLink(link)?.title).toBe(`${'a'.repeat(511)}😀`);
  });

  it('replaces malformed surrogate code units and stays within the persisted-link budget', () => {
    const malformed = createJellyfinMediaLink({
      serverId: 'server',
      itemId: 'item',
      title: '\uD800Broken\uDC00',
    });
    const emoji = createJellyfinMediaLink({
      serverId: 'server',
      itemId: 'item',
      title: '😀'.repeat(512),
    });

    expect(parseJellyfinMediaLink(malformed)?.title).toBe('Broken');
    expect(emoji.length).toBeLessThanOrEqual(4_096);
    expect(parseJellyfinMediaLink(emoji)?.title.length).toBeGreaterThan(0);
  });

  it('rejects malformed and unrelated null URLs', () => {
    for (const value of [
      'null://',
      'null://jellyfin/server/item',
      'null://jellyfin/server/item/title/extra',
      'null://jellyfin/server/%ZZ/title',
      'null://jellyfin/server/item/title%0Ainjected',
      'https://media.test/video',
    ]) {
      expect(isJellyfinMediaLink(value)).toBe(false);
    }
  });

  it('creates a readable persistent filename bound to the item identity', () => {
    const input = {
      serverId: 'server/one',
      itemId: 'episode?one',
      title: "Widow's Bay / S01E01 — Welcome!",
    };
    const reference = createJellyfinMediaReference(input);

    expect(reference.dataPath).toMatch(/^@data\/Widow's Bay S01E01 — Welcome! · jf-[0-9a-f]{16}$/);
    expect(reference.document).not.toContain('Token');
    expect(
      matchesJellyfinMediaReferencePath(
        `/plugin/data/${reference.dataPath.slice('@data/'.length)}`,
        '/plugin/data/',
        input,
      ),
    ).toBe(true);
    expect(
      matchesJellyfinMediaReferencePath('/plugin/data/Unrelated title', '/plugin/data', input),
    ).toBe(false);
  });

  it('bounds persistent history filenames by UTF-8 bytes', () => {
    const reference = createJellyfinMediaReference({
      serverId: 'server',
      itemId: 'item',
      title: '😀'.repeat(200),
    });
    const filename = reference.dataPath.slice('@data/'.length);

    expect(new TextEncoder().encode(filename).length).toBeLessThanOrEqual(203);
  });
});
