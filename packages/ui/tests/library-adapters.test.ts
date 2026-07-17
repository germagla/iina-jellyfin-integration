import { describe, expect, it } from 'vitest';

import { episodesFromResult, supportedLibrariesFromResult } from '../src/bridge/adapters';

describe('Jellyfin library adapters', () => {
  it('keeps supported Jellyfin views in server order and deduplicates their ids', () => {
    expect(
      supportedLibrariesFromResult({
        Items: [
          { Id: 'anime', Name: 'Anime', CollectionType: 'tvshows' },
          { Id: 'films', Name: 'Films', CollectionType: 'movies' },
          { Id: 'music', Name: 'Music', CollectionType: 'music' },
          { Id: 'anime', Name: 'Duplicate Anime', CollectionType: 'tvshows' },
          { Id: 'case-sensitive', Name: 'Other TV', CollectionType: 'TVShows' },
          { Id: `long-${'x'.repeat(300)}`, Name: 'Long ID', CollectionType: 'movies' },
          { Id: 'padded-id ', Name: 'Padded ID', CollectionType: 'movies' },
          { Id: 'blank-name', Name: '   ', CollectionType: 'movies' },
          { Id: 'long-name', Name: 'x'.repeat(257), CollectionType: 'movies' },
        ],
        TotalRecordCount: 9,
        StartIndex: 0,
      }),
    ).toEqual([
      { id: 'anime', name: 'Anime', kind: 'series' },
      { id: 'films', name: 'Films', kind: 'movie' },
    ]);
  });

  it('rejects malformed library results', () => {
    expect(() => supportedLibrariesFromResult({ Items: [] })).toThrow(
      'Jellyfin returned an invalid library list.',
    );
  });

  it('excludes virtual, offline, and placeholder episodes', () => {
    const episode = {
      Name: 'Episode',
      Type: 'Episode',
      SeriesName: 'Example Series',
      ParentIndexNumber: 1,
      IndexNumber: 1,
    };
    const episodes = episodesFromResult({
      Items: [
        { ...episode, Id: 'available', LocationType: 'FileSystem' },
        { ...episode, Id: 'virtual', LocationType: 'Virtual' },
        { ...episode, Id: 'offline', LocationType: 'Offline' },
        { ...episode, Id: 'placeholder', IsPlaceHolder: true },
        { ...episode, Id: 'unspecified' },
        { ...episode, Id: 'series-container', Type: 'Series' },
      ],
      TotalRecordCount: 6,
      StartIndex: 0,
    });

    expect(episodes.map(({ id }) => id)).toEqual(['available', 'unspecified']);
  });
});
