import { describe, expect, it } from 'vitest';

import type { MediaCard } from '../src/bridge/contracts';
import { groupRecentlyAdded } from '../src/catalog/recently-added';

function episode(overrides: Partial<MediaCard>): MediaCard {
  return {
    id: 'episode-1',
    title: 'Premiere',
    kind: 'episode',
    seriesId: 'series-1',
    seriesTitle: 'Example Show',
    episodeLabel: 'S1 · E1',
    episodeTitle: 'Premiere',
    ...overrides,
  };
}

describe('groupRecentlyAdded', () => {
  it('groups episodes from one series while keeping the newest episode playable', () => {
    const grouped = groupRecentlyAdded([
      episode({ id: 'episode-3', title: 'Third', episodeLabel: 'S1 · E3', episodeTitle: 'Third' }),
      episode({
        id: 'episode-2',
        title: 'Second',
        episodeLabel: 'S1 · E2',
        episodeTitle: 'Second',
      }),
      { id: 'movie-1', title: 'Movie', kind: 'movie' },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      id: 'episode-3',
      title: 'Example Show',
      subtitle: '2 new episodes · Latest S1 · E3 · Third',
      recentlyAddedEpisodeCount: 2,
    });
    expect(grouped[1]).toMatchObject({ id: 'movie-1', title: 'Movie' });
  });

  it('labels a single episode and keeps different series separate', () => {
    const grouped = groupRecentlyAdded([
      episode({}),
      episode({ id: 'other-1', seriesId: 'series-2', seriesTitle: 'Other Show' }),
    ]);

    expect(grouped.map(({ title, subtitle }) => ({ title, subtitle }))).toEqual([
      { title: 'Example Show', subtitle: 'New episode · S1 · E1 · Premiere' },
      { title: 'Other Show', subtitle: 'New episode · S1 · E1 · Premiere' },
    ]);
  });

  it('uses a normalized series title when Jellyfin omits the series id', () => {
    const grouped = groupRecentlyAdded([
      episode({ id: 'a', seriesId: undefined, seriesTitle: 'Example Show' }),
      episode({ id: 'b', seriesId: undefined, seriesTitle: ' example show ' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.recentlyAddedEpisodeCount).toBe(2);
  });

  it('replaces a matching series container with its playable latest episode group', () => {
    const grouped = groupRecentlyAdded([
      { id: 'series-1', title: 'Example Show', kind: 'series' },
      episode({ id: 'episode-2', episodeLabel: 'S1 · E2', episodeTitle: 'Second' }),
      episode({ id: 'episode-1' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      id: 'episode-2',
      title: 'Example Show',
      subtitle: '2 new episodes · Latest S1 · E2 · Second',
    });
  });
});
