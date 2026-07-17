import { describe, expect, it } from 'vitest';

import { BaseItemSchema, ItemsResultSchema } from '../src/jellyfin-schemas';

describe('Jellyfin catalog schemas', () => {
  it('retains bounded library and playability metadata at the bridge boundary', () => {
    expect(
      ItemsResultSchema.parse({
        Items: [
          {
            Id: 'library-anime',
            Name: 'Anime',
            Type: 'CollectionFolder',
            CollectionType: 'tvshows',
            LocationType: 'FileSystem',
            IsPlaceHolder: false,
          },
        ],
        TotalRecordCount: 1,
        StartIndex: 0,
      }).Items[0],
    ).toMatchObject({
      CollectionType: 'tvshows',
      LocationType: 'FileSystem',
      IsPlaceHolder: false,
    });
  });

  it('allows nullable server metadata and rejects unbounded values', () => {
    expect(
      BaseItemSchema.parse({
        Id: 'library-mixed',
        Name: 'Mixed',
        CollectionType: null,
        LocationType: null,
        IsPlaceHolder: null,
      }),
    ).toMatchObject({ CollectionType: null, LocationType: null, IsPlaceHolder: null });

    expect(() =>
      BaseItemSchema.parse({
        Id: 'hostile-library',
        Name: 'Hostile',
        CollectionType: 'x'.repeat(129),
      }),
    ).toThrow();
  });

  it('normalizes oversized and nullable Jellyfin backdrop tag lists', () => {
    const backdropTags = Array.from({ length: 12 }, (_, index) => `backdrop-${index + 1}`);
    const parsed = ItemsResultSchema.parse({
      Items: [
        {
          Id: 'series-many-backdrops',
          Name: 'Many Backdrops',
          Type: 'Series',
          BackdropImageTags: backdropTags,
        },
      ],
      TotalRecordCount: 1,
      StartIndex: 0,
    });

    expect(parsed.Items[0]?.BackdropImageTags).toEqual(backdropTags.slice(0, 8));
    expect(
      BaseItemSchema.parse({
        Id: 'series-null-tags',
        Name: 'Nullable Tags',
        ImageTags: null,
        BackdropImageTags: null,
      }),
    ).toMatchObject({ ImageTags: null, BackdropImageTags: null });
    expect(() =>
      BaseItemSchema.parse({
        Id: 'series-invalid-backdrop',
        Name: 'Invalid Backdrop',
        BackdropImageTags: ['x'.repeat(513), ...backdropTags],
      }),
    ).toThrow();
    expect(() =>
      BaseItemSchema.parse({
        Id: 'series-invalid-backdrops-shape',
        Name: 'Invalid Backdrops Shape',
        BackdropImageTags: 'not-an-array',
      }),
    ).toThrow();
  });
});
