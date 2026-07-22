import type { MediaCard } from '../bridge/contracts';

function episodeSummary(item: MediaCard, count: number): string {
  const episodeDetail = [item.episodeLabel, item.episodeTitle].filter(Boolean).join(' · ');
  if (count === 1) {
    return ['New episode', episodeDetail].filter(Boolean).join(' · ');
  }
  return [`${count} new episodes`, episodeDetail ? `Latest ${episodeDetail}` : undefined]
    .filter(Boolean)
    .join(' · ');
}

function episodeGroupKey(item: MediaCard): string | undefined {
  if (item.seriesId) return `id:${item.seriesId}`;
  const normalizedTitle = item.seriesTitle?.trim().toLocaleLowerCase();
  return normalizedTitle ? `title:${normalizedTitle}` : undefined;
}

function seriesGroupKeys(item: MediaCard): string[] {
  const normalizedTitle = item.title.trim().toLocaleLowerCase();
  return [`id:${item.id}`, ...(normalizedTitle ? [`title:${normalizedTitle}`] : [])];
}

/**
 * Jellyfin's Latest endpoint returns episodes, not just series containers. Keep
 * the newest episode playable while presenting one clearly labelled card per
 * series in the Home shelf.
 */
export function groupRecentlyAdded(items: MediaCard[]): MediaCard[] {
  const episodeKeys = new Set(
    items
      .filter((item) => item.kind === 'episode')
      .map(episodeGroupKey)
      .filter((key): key is string => key !== undefined),
  );
  const grouped: MediaCard[] = [];
  const groupIndexes = new Map<string, number>();

  for (const item of items) {
    if (item.kind !== 'episode') {
      if (item.kind === 'series' && seriesGroupKeys(item).some((key) => episodeKeys.has(key))) {
        continue;
      }
      grouped.push(item);
      continue;
    }

    const key = episodeGroupKey(item);
    const firstCard: MediaCard = {
      ...item,
      title: item.seriesTitle ?? item.title,
      subtitle: episodeSummary(item, 1),
      recentlyAddedEpisodeCount: 1,
    };
    if (key === undefined) {
      grouped.push(firstCard);
      continue;
    }

    const existingIndex = groupIndexes.get(key);
    if (existingIndex === undefined) {
      groupIndexes.set(key, grouped.length);
      grouped.push(firstCard);
      continue;
    }

    const existing = grouped[existingIndex];
    const count = (existing.recentlyAddedEpisodeCount ?? 1) + 1;
    grouped[existingIndex] = {
      ...existing,
      subtitle: episodeSummary(existing, count),
      recentlyAddedEpisodeCount: count,
    };
  }

  return grouped;
}
