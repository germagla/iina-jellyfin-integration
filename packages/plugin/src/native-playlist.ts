import type { BaseItem } from '@iina-jellyfin/core';

const MAX_EPISODES_PER_DIRECTION = 100;

function playableEpisode(item: BaseItem): boolean {
  return (
    item.Type === 'Episode' &&
    item.IsPlaceHolder !== true &&
    item.LocationType !== 'Virtual' &&
    item.LocationType !== 'Offline'
  );
}

function episodeOrder(left: BaseItem, right: BaseItem): number {
  const season =
    (left.ParentIndexNumber ?? Number.MAX_SAFE_INTEGER) -
    (right.ParentIndexNumber ?? Number.MAX_SAFE_INTEGER);
  if (season !== 0) return season;
  const episode =
    (left.IndexNumber ?? Number.MAX_SAFE_INTEGER) - (right.IndexNumber ?? Number.MAX_SAFE_INTEGER);
  if (episode !== 0) return episode;
  return left.Name.localeCompare(right.Name);
}

export interface SeasonPlaylistEpisodes {
  before: BaseItem[];
  after: BaseItem[];
}

export function selectSeasonPlaylistEpisodes(
  items: BaseItem[],
  currentItemId: string,
  seasonNumber?: number,
): SeasonPlaylistEpisodes {
  const current = items.find((item) => item.Id === currentItemId && playableEpisode(item));
  const effectiveSeasonNumber = seasonNumber ?? current?.ParentIndexNumber;
  if (current === undefined || effectiveSeasonNumber === undefined) {
    return { before: [], after: [] };
  }
  const seen = new Set<string>();
  const candidates = items
    .filter((item) => {
      if (
        !playableEpisode(item) ||
        item.ParentIndexNumber !== effectiveSeasonNumber ||
        seen.has(item.Id)
      ) {
        return false;
      }
      seen.add(item.Id);
      return true;
    })
    .sort(episodeOrder);
  const currentIndex = candidates.findIndex((item) => item.Id === currentItemId);
  if (currentIndex < 0) return { before: [], after: [] };
  return {
    before: candidates.slice(Math.max(0, currentIndex - MAX_EPISODES_PER_DIRECTION), currentIndex),
    after: candidates.slice(currentIndex + 1, currentIndex + 1 + MAX_EPISODES_PER_DIRECTION),
  };
}

/**
 * mpv only exposes a title for an unopened playlist entry when the source
 * playlist supplied one. M3U's EXTINF field lets IINA show the safe display
 * title while the credential-free Jellyfin locator remains the actual URL.
 */
export interface NativePlaylistEntry {
  location: string;
  title: string;
}

export function serializeNativePlaylist(entries: NativePlaylistEntry[]): string {
  const lines = ['#EXTM3U'];
  for (const entry of entries) {
    if (
      !entry.location.startsWith('/') ||
      /[\r\n\0]/.test(entry.location) ||
      entry.title.length === 0 ||
      /[\r\n\0]/.test(entry.title)
    ) {
      throw new TypeError('Invalid native Jellyfin playlist entry.');
    }
    lines.push(`#EXTINF:-1,${entry.title}`, entry.location);
  }
  return `${lines.join('\n')}\n`;
}
