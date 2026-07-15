import type {
  EpisodeDetails,
  MediaCard,
  MediaVersionChoice,
  SeasonChoice,
  ShowDetails,
  TrackChoice,
} from './contracts';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function ticksToMinutes(value: unknown): number | undefined {
  const ticks = numberValue(value);
  return ticks === undefined ? undefined : Math.max(1, Math.round(ticks / 600_000_000));
}

function progressFromItem(item: UnknownRecord): number | undefined {
  const userData = record(item.UserData);
  const percentage = numberValue(userData?.PlayedPercentage);
  if (percentage !== undefined) return Math.min(1, Math.max(0, percentage / 100));
  const position = numberValue(userData?.PlaybackPositionTicks);
  const duration = numberValue(item.RunTimeTicks);
  if (position !== undefined && duration !== undefined && duration > 0) {
    return Math.min(1, Math.max(0, position / duration));
  }
  return undefined;
}

function playbackPositionTicksFromItem(item: UnknownRecord): number | undefined {
  const ticks = numberValue(record(item.UserData)?.PlaybackPositionTicks);
  return ticks === undefined ? undefined : Math.max(0, Math.round(ticks));
}

export function isItemsResult(
  value: unknown,
): value is { Items: unknown[]; TotalRecordCount: number; StartIndex: number } {
  const candidate = record(value);
  return Array.isArray(candidate?.Items) && typeof candidate.TotalRecordCount === 'number';
}

export function mediaCardFromItem(value: unknown): MediaCard | undefined {
  const item = record(value);
  const id = stringValue(item?.Id);
  const title = stringValue(item?.Name);
  if (!item || !id || !title) return undefined;

  const type = stringValue(item.Type);
  const kind = type === 'Movie' ? 'movie' : type === 'Episode' ? 'episode' : 'series';
  const seasonNumber = numberValue(item.ParentIndexNumber);
  const episodeNumber = numberValue(item.IndexNumber);
  const seriesName = stringValue(item.SeriesName);
  const episodeLabel =
    seasonNumber !== undefined && episodeNumber !== undefined
      ? `S${seasonNumber} · E${episodeNumber}`
      : undefined;
  const imageTags = record(item.ImageTags);
  const primaryTag = stringValue(imageTags?.Primary);
  const thumbTag = stringValue(imageTags?.Thumb);

  return {
    id,
    title,
    subtitle: seriesName
      ? `${seriesName}${episodeLabel ? ` · ${episodeLabel}` : ''}`
      : episodeLabel,
    year: numberValue(item.ProductionYear),
    runtimeMinutes: ticksToMinutes(item.RunTimeTicks),
    playbackPositionTicks: playbackPositionTicksFromItem(item),
    progress: progressFromItem(item),
    unwatchedCount:
      numberValue(item.UnwatchedCount) ?? numberValue(record(item.UserData)?.UnplayedItemCount),
    kind,
    artwork: stringValue(item.DemoArtwork),
    imageTag: primaryTag ?? thumbTag,
    imageType: primaryTag ? 'Primary' : thumbTag ? 'Thumb' : undefined,
  };
}

export function mediaCardsFromResult(value: unknown): {
  items: MediaCard[];
  total: number;
  startIndex: number;
} {
  if (Array.isArray(value)) {
    const items = value
      .map(mediaCardFromItem)
      .filter((item): item is MediaCard => item !== undefined);
    return { items, total: items.length, startIndex: 0 };
  }
  if (!isItemsResult(value)) throw new Error('Jellyfin returned an invalid item list.');
  const items = value.Items.map(mediaCardFromItem).filter(
    (item): item is MediaCard => item !== undefined,
  );
  return { items, total: value.TotalRecordCount, startIndex: value.StartIndex };
}

function trackChoices(streams: unknown[], type: 'Audio' | 'Subtitle'): TrackChoice[] {
  return streams.flatMap((value) => {
    const stream = record(value);
    const index = numberValue(stream?.Index);
    if (!stream || stream.Type !== type || index === undefined) return [];
    const label =
      stringValue(stream.DisplayTitle) ?? stringValue(stream.Language) ?? `${type} ${index}`;
    return [{ id: String(index), label }];
  });
}

function defaultTrackId(
  source: UnknownRecord,
  streams: unknown[],
  tracks: TrackChoice[],
  type: 'Audio' | 'Subtitle',
): string | undefined {
  const explicit = numberValue(
    type === 'Audio' ? source.DefaultAudioStreamIndex : source.DefaultSubtitleStreamIndex,
  );
  if (explicit !== undefined && (type === 'Subtitle' || explicit >= 0)) {
    const id = String(explicit);
    if (type === 'Subtitle' && explicit === -1) return id;
    if (tracks.some((track) => track.id === id)) return id;
  }

  for (const value of streams) {
    const stream = record(value);
    const index = numberValue(stream?.Index);
    if (stream?.Type === type && stream.IsDefault === true && index !== undefined) {
      return String(index);
    }
  }
  return undefined;
}

function fallbackVersion(): MediaVersionChoice {
  return {
    id: '',
    label: 'Automatic',
    audioTracks: [{ id: '', label: 'Default audio' }],
    subtitleTracks: [{ id: '-1', label: 'Off' }],
    defaultAudioTrackId: '',
    defaultSubtitleTrackId: '-1',
  };
}

function mediaVersionsFromItem(item: UnknownRecord): MediaVersionChoice[] {
  const mediaSources = Array.isArray(item.MediaSources) ? item.MediaSources : [];
  const versions = mediaSources.flatMap((value) => {
    const source = record(value);
    const sourceId = stringValue(source?.Id);
    if (!source || !sourceId) return [];
    const streams = Array.isArray(source.MediaStreams) ? source.MediaStreams : [];
    const audioTracks = trackChoices(streams, 'Audio');
    const subtitleTracks = [{ id: '-1', label: 'Off' }, ...trackChoices(streams, 'Subtitle')];
    const defaultAudioTrackId =
      defaultTrackId(source, streams, audioTracks, 'Audio') ?? audioTracks[0]?.id ?? '';
    const defaultSubtitleTrackId =
      defaultTrackId(source, streams, subtitleTracks, 'Subtitle') ?? '-1';
    return [
      {
        id: sourceId,
        label: stringValue(source.Name) ?? stringValue(source.Container) ?? 'Default version',
        audioTracks: audioTracks.length ? audioTracks : [{ id: '', label: 'Default audio' }],
        subtitleTracks,
        defaultAudioTrackId,
        defaultSubtitleTrackId,
      },
    ];
  });
  return versions.length ? versions : [fallbackVersion()];
}

export function showDetailsFromResult(value: unknown): ShowDetails {
  if (isShowDetails(value)) return value;
  const item = record(value);
  const id = stringValue(item?.Id);
  const name = stringValue(item?.Name);
  if (!item || !id || !name) throw new Error('Jellyfin returned invalid item details.');

  const runtimeMinutes = ticksToMinutes(item.RunTimeTicks) ?? 0;
  const progress = progressFromItem(item) ?? 0;
  const remaining = Math.max(0, Math.round(runtimeMinutes * (1 - progress)));
  const versions = mediaVersionsFromItem(item);
  const backdropTags = Array.isArray(item.BackdropImageTags) ? item.BackdropImageTags : [];
  const playbackPositionTicks = playbackPositionTicksFromItem(item) ?? 0;
  const seasonNumber = numberValue(item.ParentIndexNumber);

  return {
    id,
    seriesId: stringValue(item.SeriesId) ?? (stringValue(item.Type) === 'Series' ? id : undefined),
    title: stringValue(item.SeriesName) ?? name,
    episodeTitle: name,
    episodeLabel:
      numberValue(item.ParentIndexNumber) !== undefined &&
      numberValue(item.IndexNumber) !== undefined
        ? `S${numberValue(item.ParentIndexNumber)} · E${numberValue(item.IndexNumber)}`
        : stringValue(item.Type) === 'Movie'
          ? 'Movie'
          : stringValue(item.Type) === 'Series'
            ? 'Series'
            : 'Episode',
    overview: stringValue(item.Overview) ?? 'No overview is available.',
    year: numberValue(item.ProductionYear) ?? new Date().getFullYear(),
    runtimeMinutes,
    officialRating: stringValue(item.OfficialRating) ?? 'NR',
    communityRating: numberValue(item.CommunityRating) ?? 0,
    progress,
    playbackPositionTicks,
    progressLabel: remaining > 0 ? `${remaining} min remaining` : 'Not started',
    seasonProgressLabel: 'Episode progress',
    heroImageTag: stringValue(backdropTags[0]),
    heroItemId: stringValue(item.ParentBackdropItemId) ?? id,
    seasons:
      seasonNumber === undefined
        ? []
        : [
            {
              id: `season-index:${seasonNumber}`,
              label: `Season ${seasonNumber}`,
              indexNumber: seasonNumber,
            },
          ],
    versions,
    episodes: [],
  };
}

function isShowDetails(value: unknown): value is ShowDetails {
  const candidate = record(value);
  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.overview === 'string' &&
    Array.isArray(candidate.episodes) &&
    Array.isArray(candidate.versions)
  );
}

export function episodesFromResult(value: unknown): EpisodeDetails[] {
  const values = Array.isArray(value)
    ? value
    : isItemsResult(value)
      ? value.Items
      : (() => {
          throw new Error('Jellyfin returned an invalid episode list.');
        })();
  return values.flatMap((value) => {
    const raw = record(value);
    const item = mediaCardFromItem(value);
    if (!raw || !item) return [];
    return [
      {
        ...item,
        episodeNumber: numberValue(raw.IndexNumber),
        seasonNumber: numberValue(raw.ParentIndexNumber),
        durationLabel: item.runtimeMinutes ? `${item.runtimeMinutes} min` : '',
        versions: mediaVersionsFromItem(raw),
      },
    ];
  });
}

export function seasonsFromEpisodes(episodes: EpisodeDetails[]): SeasonChoice[] {
  const numbers = Array.from(
    new Set(
      episodes.flatMap((episode) =>
        episode.seasonNumber === undefined ? [] : [episode.seasonNumber],
      ),
    ),
  ).sort((a, b) => a - b);
  const seasons: SeasonChoice[] = numbers.map((indexNumber) => ({
    id: `season-index:${indexNumber}`,
    label: `Season ${indexNumber}`,
    indexNumber,
  }));
  if (episodes.some((episode) => episode.seasonNumber === undefined)) {
    seasons.push({ id: 'season-unknown', label: numbers.length ? 'Other episodes' : 'Episodes' });
  }
  return seasons;
}
