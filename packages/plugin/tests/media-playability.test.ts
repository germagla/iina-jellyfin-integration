import { describe, expect, it } from 'vitest';

import { assertPlayableMediaItem } from '../src/media-playability';

describe('trusted playback item validation', () => {
  it.each(['Movie', 'Episode'] as const)('allows a concrete %s', (Type) => {
    expect(() => assertPlayableMediaItem({ Id: 'item-1', Name: 'Available', Type })).not.toThrow();
  });

  it.each([
    { Type: 'Series' as const },
    { Type: 'Folder' as const },
    { Type: 'Episode' as const, LocationType: 'Virtual' },
    { Type: 'Movie' as const, LocationType: 'Offline' },
    { Type: 'Episode' as const, IsPlaceHolder: true },
  ])('rejects a non-playable item %#', (metadata) => {
    expect(() =>
      assertPlayableMediaItem({ Id: 'item-1', Name: 'Unavailable', ...metadata }),
    ).toThrow();
  });
});
