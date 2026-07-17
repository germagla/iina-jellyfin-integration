import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  Cube,
  Play,
  SpeakerHigh,
  SpinnerGap,
  Star,
  Subtitles,
  Warning,
  X,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  BridgePayload,
  CatalogBridge,
  EpisodeDetails,
  MediaVersionChoice,
  ShowDetails,
  SupportedLibrary,
  TrackChoice,
} from '../bridge/contracts';
import { ProgressBar } from '../components/ProgressBar';
import { showDetailsFromResult } from '../bridge/adapters';
import { BrokeredArtwork } from './Artwork';
import { AppChrome, type CatalogReturnRoute, type CatalogRoute } from './Chrome';

interface DetailsScreenProps {
  bridge: CatalogBridge;
  show: ShowDetails;
  libraries: SupportedLibrary[];
  selectedLibraryId?: string;
  activeRoute: CatalogReturnRoute;
  onNavigate: (route: CatalogRoute) => void;
  onSelectLibrary: (libraryId: string) => void;
  onBack: () => void;
  onDisconnect: () => void;
}

interface ConfirmationState {
  reason: string;
  payload: BridgePayload<'playback.start'>;
  confirmationId: string;
}

interface PlaybackSelection {
  versionId: string;
  audioTrackId: string;
  subtitleTrackId: string;
}

function episodeLabel(episode: EpisodeDetails): string {
  if (episode.seasonNumber !== undefined && episode.episodeNumber !== undefined) {
    return `S${episode.seasonNumber} · E${episode.episodeNumber}`;
  }
  if (episode.episodeNumber !== undefined) return `E${episode.episodeNumber}`;
  return 'Episode';
}

function detailsForEpisode(show: ShowDetails, episode: EpisodeDetails | undefined): ShowDetails {
  if (!episode) return show;
  const runtimeMinutes = episode.runtimeMinutes ?? show.runtimeMinutes;
  return {
    ...show,
    id: episode.id,
    kind: 'episode',
    playable: true,
    episodeTitle: episode.title,
    episodeLabel: episodeLabel(episode),
    runtimeMinutes,
    progress: episode.progress ?? 0,
    playbackPositionTicks: episode.playbackPositionTicks ?? 0,
    progressLabel: episode.progress
      ? `${Math.max(0, Math.round(runtimeMinutes * (1 - episode.progress)))} min remaining`
      : 'Not started',
    versions: episode.versions.length ? episode.versions : show.versions,
  };
}

function selectionForVersions(
  versions: MediaVersionChoice[],
  preferredVersionId?: string,
): PlaybackSelection {
  const version = versions.find((candidate) => candidate.id === preferredVersionId) ?? versions[0];
  return {
    versionId: version?.id ?? '',
    audioTrackId: version?.defaultAudioTrackId ?? version?.audioTracks[0]?.id ?? '',
    subtitleTrackId: version?.defaultSubtitleTrackId ?? '-1',
  };
}

function seasonIdForEpisode(show: ShowDetails, episode: EpisodeDetails | undefined): string {
  if (episode?.seasonNumber !== undefined) {
    return (
      show.seasons.find((season) => season.indexNumber === episode.seasonNumber)?.id ??
      show.seasons[0]?.id ??
      ''
    );
  }
  return (
    show.seasons.find((season) => season.indexNumber === undefined)?.id ?? show.seasons[0]?.id ?? ''
  );
}

function ChoiceRow({
  icon,
  label,
  value,
  choices,
  disabled = false,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  choices: TrackChoice[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="choice-row">
      <span className="choice-row__label">
        {icon}
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      >
        {choices.map((choice) => (
          <option value={choice.id} key={choice.id}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DetailsScreen({
  bridge,
  show,
  libraries,
  selectedLibraryId,
  activeRoute,
  onNavigate,
  onSelectLibrary,
  onBack,
  onDisconnect,
}: DetailsScreenProps) {
  const matchingEpisode = show.episodes.find((episode) => episode.id === show.id);
  const initialEpisode =
    matchingEpisode ??
    (show.kind === 'series'
      ? (show.episodes.find((episode) => episode.selected) ?? show.episodes[0])
      : undefined);
  const initialDetails = detailsForEpisode(show, initialEpisode);
  const [details, setDetails] = useState(initialDetails);
  const [selection, setSelection] = useState(() => selectionForVersions(initialDetails.versions));
  const [seasonId, setSeasonId] = useState(() => seasonIdForEpisode(show, initialEpisode));
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(initialEpisode?.id ?? '');
  const [episodeLoadingId, setEpisodeLoadingId] = useState<string>();
  const episodeRequestGeneration = useRef(0);
  const [confirmation, setConfirmation] = useState<ConfirmationState>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const visibleEpisodes = useMemo(() => {
    const season = show.seasons.find((candidate) => candidate.id === seasonId);
    if (!season) return show.episodes;
    return show.episodes.filter((episode) => episode.seasonNumber === season.indexNumber);
  }, [seasonId, show.episodes, show.seasons]);
  const selectedVersion =
    details.versions.find((version) => version.id === selection.versionId) ?? details.versions[0];
  const isPlayable = details.playable && (details.kind === 'movie' || details.kind === 'episode');
  const isResumable = isPlayable && details.playbackPositionTicks > 0;
  const playableLabel = details.kind === 'movie' ? 'Movie' : 'Episode';

  function playbackPayload(
    startPositionTicks: number,
    openInNewWindow: boolean,
  ): BridgePayload<'playback.start'> {
    if (!isPlayable) throw new Error('This item is not available for playback.');
    const audioIndex = Number(selection.audioTrackId);
    const subtitleIndex = Number(selection.subtitleTrackId);
    return {
      itemId: details.id,
      startPositionTicks,
      maxStreamingBitrate: 120_000_000,
      openInNewWindow,
      ...(selection.versionId ? { mediaSourceId: selection.versionId } : {}),
      ...(selection.audioTrackId && Number.isInteger(audioIndex)
        ? { audioStreamIndex: audioIndex }
        : {}),
      ...(selection.subtitleTrackId && Number.isInteger(subtitleIndex)
        ? { subtitleStreamIndex: subtitleIndex }
        : {}),
    };
  }

  async function requestPlayback(
    startMode: 'resume' | 'beginning',
    newWindow = false,
  ): Promise<void> {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const startPositionTicks = startMode === 'resume' ? details.playbackPositionTicks : 0;
    try {
      const payload = playbackPayload(startPositionTicks, newWindow);
      const result = await bridge.request('playback.start', payload);
      if (result.status === 'confirmation-required') {
        setConfirmation({
          reason: result.plan.transcodeReasons.length
            ? result.plan.transcodeReasons.join(', ')
            : 'Jellyfin needs to convert the video before it can play.',
          payload,
          confirmationId: result.confirmationId,
        });
      } else {
        setNotice(newWindow ? 'Opening in a new IINA window…' : 'Starting playback in IINA…');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Playback could not be started.');
    } finally {
      setBusy(false);
    }
  }

  async function selectEpisode(episodeId: string, nextSeasonId?: string): Promise<void> {
    const episode = show.episodes.find((candidate) => candidate.id === episodeId);
    if (!episode) return;
    const generation = ++episodeRequestGeneration.current;
    setSelectedEpisodeId(episodeId);
    setSeasonId(nextSeasonId ?? seasonIdForEpisode(show, episode));
    setEpisodeLoadingId(episodeId);
    setConfirmation(undefined);
    setNotice(undefined);
    setError(undefined);
    const optimisticDetails = detailsForEpisode(show, episode);
    setDetails(optimisticDetails);
    setSelection(selectionForVersions(optimisticDetails.versions));
    try {
      const result = await bridge.request('catalog.query', { kind: 'details', itemId: episodeId });
      if (generation !== episodeRequestGeneration.current) return;
      const episodeDetails = showDetailsFromResult(result);
      const mergedDetails = {
        ...episodeDetails,
        title: episodeDetails.title || show.title,
        heroArtwork: episodeDetails.heroArtwork ?? show.heroArtwork,
        heroImageTag: episodeDetails.heroImageTag ?? show.heroImageTag,
        heroItemId: episodeDetails.heroItemId ?? show.heroItemId,
        seasons: show.seasons,
        episodes: show.episodes,
      };
      setDetails(mergedDetails);
      setSelection(selectionForVersions(mergedDetails.versions));
    } catch (reason) {
      if (generation !== episodeRequestGeneration.current) return;
      setError(
        reason instanceof Error ? reason.message : 'Episode details could not be refreshed.',
      );
    } finally {
      if (generation === episodeRequestGeneration.current) setEpisodeLoadingId(undefined);
    }
  }

  function selectSeason(nextSeasonId: string): void {
    setSeasonId(nextSeasonId);
    const season = show.seasons.find((candidate) => candidate.id === nextSeasonId);
    const firstEpisode = show.episodes.find(
      (episode) => episode.seasonNumber === season?.indexNumber,
    );
    if (firstEpisode && firstEpisode.id !== selectedEpisodeId) {
      void selectEpisode(firstEpisode.id, nextSeasonId);
    }
  }

  function selectVersion(nextVersionId: string): void {
    setSelection(selectionForVersions(details.versions, nextVersionId));
  }

  async function confirmTranscode(): Promise<void> {
    if (!confirmation) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await bridge.request('playback.start', {
        ...confirmation.payload,
        videoTranscodeConfirmationId: confirmation.confirmationId,
      });
      if (result.status === 'confirmation-required') {
        setConfirmation({
          reason: result.plan.transcodeReasons.length
            ? result.plan.transcodeReasons.join(', ')
            : 'Jellyfin needs to convert the video before it can play.',
          payload: confirmation.payload,
          confirmationId: result.confirmationId,
        });
        setError('The playback plan changed or the approval expired. Review it and confirm again.');
        return;
      }
      const newWindow = confirmation.payload.openInNewWindow;
      setConfirmation(undefined);
      setNotice(
        newWindow
          ? 'Opening converted playback in a new IINA window…'
          : 'Starting converted playback in IINA…',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Playback could not be started.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="details-screen">
      <BrokeredArtwork
        bridge={bridge}
        itemId={details.heroItemId ?? details.id}
        imageType="Backdrop"
        imageTag={details.heroImageTag}
        width={1600}
        height={900}
        source={details.heroArtwork}
        alt=""
        className="details-screen__hero"
      />
      <div className="details-screen__wash" aria-hidden="true" />
      <AppChrome
        route="details"
        libraries={libraries}
        selectedLibraryId={selectedLibraryId}
        activeRoute={activeRoute}
        onNavigate={onNavigate}
        onSelectLibrary={onSelectLibrary}
        onDisconnect={onDisconnect}
        translucent
      />

      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={19} aria-hidden="true" />
        Back
      </button>

      <section className="details-content" aria-labelledby="details-title">
        <p className="details-kicker">
          {details.episodeLabel} · {details.episodeTitle}
        </p>
        <h1 id="details-title">{details.title}</h1>
        <p className="episode-heading">
          {details.kind === 'series'
            ? 'Series'
            : `${details.episodeLabel} · ${details.episodeTitle}`}
        </p>
        <div className="metadata-row" aria-label="Media metadata">
          {details.runtimeMinutes > 0 ? <span>{details.runtimeMinutes} min</span> : null}
          <span className="rating-badge">{details.officialRating}</span>
          <span>{details.year}</span>
          <span className="star-rating">
            <Star size={16} weight="fill" aria-hidden="true" />
            {details.communityRating}
          </span>
        </div>
        <p className="details-overview">{details.overview}</p>

        {isPlayable ? (
          <>
            {isResumable ? (
              <div className="season-progress">
                <span>
                  <span>Progress</span>
                  <span>{details.seasonProgressLabel}</span>
                </span>
                <ProgressBar
                  className="progress-track"
                  label={`${Math.round(Math.min(1, Math.max(0, details.progress)) * 100)} percent watched`}
                  value={details.progress}
                />
              </div>
            ) : null}

            <div className="playback-actions">
              <button
                className="primary-button play-button"
                type="button"
                disabled={busy}
                onClick={() => void requestPlayback(isResumable ? 'resume' : 'beginning')}
              >
                {busy ? (
                  <SpinnerGap className="spin" size={22} aria-hidden="true" />
                ) : (
                  <Play size={22} weight="fill" aria-hidden="true" />
                )}
                <span>
                  <strong>
                    {isResumable ? `Resume ${playableLabel}` : `Play ${playableLabel}`}
                  </strong>
                  {isResumable ? <small>{details.progressLabel}</small> : null}
                </span>
              </button>
              {isResumable ? (
                <button
                  className="secondary-button play-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void requestPlayback('beginning')}
                >
                  <Play size={21} weight="fill" aria-hidden="true" />
                  <span>
                    <strong>Play from Beginning</strong>
                  </span>
                </button>
              ) : null}
              <button
                className="tertiary-button"
                type="button"
                disabled={busy}
                onClick={() => void requestPlayback(isResumable ? 'resume' : 'beginning', true)}
              >
                <ArrowSquareOut size={18} aria-hidden="true" />
                Open in New Window
              </button>
            </div>

            <div className="track-choices">
              <ChoiceRow
                icon={<Cube size={20} aria-hidden="true" />}
                label="Version"
                value={selection.versionId}
                choices={details.versions}
                disabled={busy}
                onChange={selectVersion}
              />
              <ChoiceRow
                icon={<SpeakerHigh size={20} aria-hidden="true" />}
                label="Audio"
                value={selection.audioTrackId}
                choices={selectedVersion?.audioTracks ?? []}
                disabled={busy}
                onChange={(audioTrackId) =>
                  setSelection((current) => ({ ...current, audioTrackId }))
                }
              />
              <ChoiceRow
                icon={<Subtitles size={20} aria-hidden="true" />}
                label="Subtitles"
                value={selection.subtitleTrackId}
                choices={selectedVersion?.subtitleTracks ?? []}
                disabled={busy}
                onChange={(subtitleTrackId) =>
                  setSelection((current) => ({ ...current, subtitleTrackId }))
                }
              />
            </div>
          </>
        ) : (
          <p className="playback-unavailable" role="status">
            {details.kind === 'series'
              ? 'No playable episodes are available in this series.'
              : 'This item is not available for playback.'}
          </p>
        )}

        {notice ? (
          <p className="playback-notice" role="status">
            <Check size={18} weight="bold" aria-hidden="true" />
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="playback-error" role="alert">
            <Warning size={18} aria-hidden="true" />
            {error}
          </p>
        ) : null}
      </section>

      {show.episodes.length > 0 ? (
        <section className="episode-section" aria-labelledby="season-heading">
          <label className="season-select">
            <span id="season-heading" className="visually-hidden">
              Season
            </span>
            <select
              value={seasonId}
              disabled={busy}
              onChange={(event) => selectSeason(event.target.value)}
              aria-label="Season"
            >
              {show.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.label}
                </option>
              ))}
            </select>
          </label>
          <div className="episode-strip">
            {visibleEpisodes.map((episode) => (
              <button
                key={episode.id}
                type="button"
                disabled={busy}
                className={
                  episode.id === selectedEpisodeId
                    ? 'episode-card episode-card--selected'
                    : 'episode-card'
                }
                onClick={() => void selectEpisode(episode.id)}
                aria-pressed={episode.id === selectedEpisodeId}
                aria-busy={episodeLoadingId === episode.id}
              >
                <span className="episode-card__artwork">
                  <BrokeredArtwork
                    bridge={bridge}
                    itemId={episode.id}
                    imageType={episode.imageType ?? 'Thumb'}
                    imageTag={episode.imageTag}
                    width={640}
                    height={360}
                    source={episode.artwork}
                    alt=""
                    className="episode-card__image"
                  />
                  {episode.id === selectedEpisodeId ? (
                    <span className="selected-check">
                      <Check size={15} weight="bold" aria-hidden="true" />
                    </span>
                  ) : null}
                  {typeof episode.progress === 'number' ? (
                    <ProgressBar
                      className="episode-card__progress"
                      label={`${Math.round(Math.min(1, Math.max(0, episode.progress)) * 100)} percent watched`}
                      value={episode.progress}
                    />
                  ) : null}
                </span>
                <span className="episode-card__copy">
                  <strong>
                    {episode.episodeNumber !== undefined ? `${episode.episodeNumber}. ` : ''}
                    {episode.title}
                  </strong>
                  <span>{episode.durationLabel}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {confirmation ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transcode-title"
            aria-describedby="transcode-description"
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setConfirmation(undefined)}
              aria-label="Close transcode confirmation"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="modal-icon">
              <Warning size={25} weight="fill" aria-hidden="true" />
            </span>
            <h2 id="transcode-title">Video conversion required</h2>
            <p id="transcode-description">{confirmation.reason}</p>
            <p className="modal-detail">
              The Jellyfin server will re-encode the video. This may use significant server
              resources.
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                onClick={() => setConfirmation(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={() => void confirmTranscode()}
              >
                {busy ? 'Starting…' : 'Convert and Play'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
