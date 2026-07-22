import { describe, expect, it } from 'vitest';
import type { BaseItem } from '@iina-jellyfin/core';
import { selectSeasonPlaylistEpisodes, serializeNativePlaylist } from '../src/native-playlist';

function episode(id: string, season: number, number: number, overrides: Partial<BaseItem> = {}) {
  return {
    Id: id,
    Name: `Episode ${number}`,
    Type: 'Episode',
    ParentIndexNumber: season,
    IndexNumber: number,
    LocationType: 'FileSystem',
    ...overrides,
  } satisfies BaseItem;
}

describe('native playlist selection', () => {
  it('returns playable earlier and later episodes in stable season order', () => {
    const items = [
      episode('e3', 1, 3),
      episode('e1', 1, 1),
      episode('virtual', 1, 4, { LocationType: 'Virtual' }),
      episode('e2', 1, 2),
      episode('other-season', 2, 1),
      episode('e3', 1, 3),
    ];

    expect(selectSeasonPlaylistEpisodes(items, 'e2', 1)).toMatchObject({
      before: [{ Id: 'e1' }],
      after: [{ Id: 'e3' }],
    });
  });

  it('does not guess a queue when the selected episode is absent', () => {
    expect(selectSeasonPlaylistEpisodes([episode('e2', 1, 2)], 'missing', 1)).toEqual({
      before: [],
      after: [],
    });
  });

  it('infers the current season without crossing into adjacent seasons', () => {
    expect(
      selectSeasonPlaylistEpisodes(
        [episode('season-one', 1, 10), episode('current', 2, 1), episode('next', 2, 2)],
        'current',
      ),
    ).toMatchObject({
      before: [],
      after: [{ Id: 'next' }],
    });
  });

  it('declines a queue when the current episode has no trustworthy season', () => {
    expect(
      selectSeasonPlaylistEpisodes(
        [episode('current', 1, 1, { ParentIndexNumber: undefined }), episode('next', 1, 2)],
        'current',
      ),
    ).toEqual({ before: [], after: [] });
  });

  it('caps an unusually large season at one hundred entries in each direction', () => {
    const items = Array.from({ length: 250 }, (_, index) => episode(`e${index + 1}`, 1, index + 1));
    const selected = selectSeasonPlaylistEpisodes(items, 'e125', 1);

    expect(selected.before).toHaveLength(100);
    expect(selected.before[0]?.Id).toBe('e25');
    expect(selected.after).toHaveLength(100);
    expect(selected.after.at(-1)?.Id).toBe('e225');
  });

  it('serializes a readable title for every credential-free playlist entry', () => {
    const first = {
      location: '/plugin/data/Test Show — S01E02 — A Title, With a Comma',
      title: 'Test Show — S01E02 — A Title, With a Comma',
    };
    const second = {
      location: '/plugin/data/Test Show — S01E03 — Unicode 日本語',
      title: 'Test Show — S01E03 — Unicode: 日本語',
    };

    expect(serializeNativePlaylist([first, second])).toBe(
      `#EXTM3U\n#EXTINF:-1,Test Show — S01E02 — A Title, With a Comma\n${first.location}\n#EXTINF:-1,Test Show — S01E03 — Unicode: 日本語\n${second.location}\n`,
    );
  });

  it('rejects network URLs and line injection from the managed playlist', () => {
    expect(() =>
      serializeNativePlaylist([
        { location: 'https://media.test/stream?api_key=secret', title: 'Episode' },
      ]),
    ).toThrow('Invalid native Jellyfin playlist entry.');
    expect(() =>
      serializeNativePlaylist([{ location: '/plugin/data/Episode\nnext', title: 'Episode' }]),
    ).toThrow('Invalid native Jellyfin playlist entry.');
  });
});
