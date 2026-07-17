import type { BaseItem } from '@iina-jellyfin/core';

export function assertPlayableMediaItem(item: BaseItem): void {
  if (item.Type !== 'Movie' && item.Type !== 'Episode') {
    throw new Error('Only Jellyfin movies and episodes can be played.');
  }
  if (
    item.IsPlaceHolder === true ||
    item.LocationType === 'Virtual' ||
    item.LocationType === 'Offline'
  ) {
    throw new Error('This Jellyfin item is not available for playback.');
  }
}
