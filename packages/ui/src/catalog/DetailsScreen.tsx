import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  Cube,
  Pause,
  Play,
  SpeakerHigh,
  SpinnerGap,
  Star,
  Subtitles,
  Warning,
  X,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  BridgePayload,
  CatalogBridge,
  EpisodeDetails,
  MediaVersionChoice,
  PublicPlaybackState,
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

const TICKS_PER_SECOND = 10_000_000;
const PLAYBACK_ACKNOWLEDGEMENT_TIMEOUT_MS = 20_000;
const PLAYBACK_PREPARATION_TIMEOUT_MS = 60_000;
const PLAYBACK_ACKNOWLEDGEMENT_ERROR =
  'IINA did not report that playback started. Check the player window and try again.';

function isActivePlaybackState(state: PublicPlaybackState): boolean {
  return state.status === 'preparing' || state.status === 'playing' || state.status === 'paused';
}

function preferredPlaybackState(
  states: PublicPlaybackState[],
  itemId: string,
  requestedPlaybackId?: string,
): PublicPlaybackState | undefined {
  const matches = states.filter((state) => state.itemId === itemId);
  const requested = matches.find((state) => state.playbackId === requestedPlaybackId);
  if (requested !== undefined && isActivePlaybackState(requested)) return requested;
  const active = matches
    .filter(isActivePlaybackState)
    .sort(
      (left, right) => right.startedAtMs - left.startedAtMs || right.updatedAtMs - left.updatedAtMs,
    )[0];
  if (active !== undefined) return active;
  if (requested !== undefined) return requested;
  return matches.sort(
    (left, right) => right.startedAtMs - left.startedAtMs || right.updatedAtMs - left.updatedAtMs,
  )[0];
}

function ticksToClock(ticks: number): string {
  const seconds = Math.max(0, Math.floor(ticks / TICKS_PER_SECOND));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function currentPlaybackPosition(state: PublicPlaybackState | undefined, nowMs: number): number {
  if (state === undefined) return 0;
  const elapsedTicks =
    state.status === 'playing' && state.playbackRate !== undefined && state.isBuffering === false
      ? Math.max(0, nowMs - state.updatedAtMs) * (TICKS_PER_SECOND / 1_000) * state.playbackRate
      : 0;
  return Math.min(
    state.durationTicks ?? Number.MAX_SAFE_INTEGER,
    state.positionTicks + elapsedTicks,
  );
}

function playbackProgress(state: PublicPlaybackState | undefined, positionTicks: number): number {
  if (!state?.durationTicks) return 0;
  if (state.status === 'stopped' && state.stopReason === 'completed') return 1;
  return Math.min(1, Math.max(0, positionTicks / state.durationTicks));
}

function playbackStatusText(state: PublicPlaybackState, positionTicks: number): string {
  const timing = state.durationTicks
    ? `${ticksToClock(positionTicks)} of ${ticksToClock(state.durationTicks)}`
    : ticksToClock(positionTicks);
  if (state.status === 'preparing') return 'Starting playback in IINA…';
  if (state.status === 'playing') return `Playing in IINA · ${timing}`;
  if (state.status === 'paused') return `Paused in IINA · ${timing}`;
  if (state.status === 'error') return 'Playback failed in IINA.';
  if (state.stopReason === 'completed') return 'Finished playing in IINA.';
  return `Playback stopped in IINA · ${timing}`;
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
  const [playbackStates, setPlaybackStates] = useState<PublicPlaybackState[]>(
    () => bridge.getPlaybackStates?.() ?? [],
  );
  const [requestedPlaybackId, setRequestedPlaybackId] = useState<string>();
  const [playbackAcknowledgementStartedAtMs, setPlaybackAcknowledgementStartedAtMs] =
    useState<number>();
  const [clockNowMs, setClockNowMs] = useState(Date.now);
  const requestedPlaybackState = useMemo(
    () => playbackStates.find((state) => state.playbackId === requestedPlaybackId),
    [playbackStates, requestedPlaybackId],
  );
  const awaitingPlaybackAcknowledgement =
    requestedPlaybackId !== undefined && playbackAcknowledgementStartedAtMs !== undefined;
  const playbackState = useMemo(
    () =>
      awaitingPlaybackAcknowledgement
        ? requestedPlaybackState
        : preferredPlaybackState(playbackStates, details.id, requestedPlaybackId),
    [
      awaitingPlaybackAcknowledgement,
      details.id,
      playbackStates,
      requestedPlaybackId,
      requestedPlaybackState,
    ],
  );

  useEffect(() => {
    setPlaybackStates(bridge.getPlaybackStates?.() ?? []);
    return bridge.subscribePlaybackStates?.(setPlaybackStates);
  }, [bridge]);

  useEffect(() => {
    setClockNowMs(Date.now());
    if (
      !playbackStates.some((state) => state.status === 'preparing' || state.status === 'playing')
    ) {
      return;
    }
    const timer = setInterval(() => setClockNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [playbackStates]);

  useEffect(() => {
    if (requestedPlaybackState === undefined || playbackAcknowledgementStartedAtMs === undefined) {
      return;
    }
    setNotice(undefined);
    setPlaybackAcknowledgementStartedAtMs(undefined);
    setError((current) => (current === PLAYBACK_ACKNOWLEDGEMENT_ERROR ? undefined : current));
  }, [playbackAcknowledgementStartedAtMs, requestedPlaybackState]);

  useEffect(() => {
    if (
      requestedPlaybackId === undefined ||
      playbackAcknowledgementStartedAtMs === undefined ||
      playbackStates.some((state) => state.playbackId === requestedPlaybackId)
    ) {
      return;
    }
    const elapsed = Date.now() - playbackAcknowledgementStartedAtMs;
    const timer = setTimeout(
      () => {
        setRequestedPlaybackId(undefined);
        setPlaybackAcknowledgementStartedAtMs(undefined);
        setNotice(undefined);
        setError(PLAYBACK_ACKNOWLEDGEMENT_ERROR);
      },
      Math.max(0, PLAYBACK_ACKNOWLEDGEMENT_TIMEOUT_MS - elapsed),
    );
    return () => clearTimeout(timer);
  }, [playbackAcknowledgementStartedAtMs, playbackStates, requestedPlaybackId]);

  useEffect(() => {
    const refreshedEpisode = show.episodes.find((episode) => episode.id === details.id);
    if (show.id !== details.id && refreshedEpisode === undefined) return;
    const refreshed = detailsForEpisode(show, refreshedEpisode);
    setDetails((current) => {
      if (current.id !== refreshed.id) return current;
      return {
        ...current,
        progress: refreshed.progress,
        playbackPositionTicks: refreshed.playbackPositionTicks,
        progressLabel: refreshed.progressLabel,
        seasonProgressLabel: refreshed.seasonProgressLabel,
        seasons: show.seasons,
        episodes: show.episodes,
      };
    });
  }, [details.id, show]);

  const visibleEpisodes = useMemo(() => {
    const season = show.seasons.find((candidate) => candidate.id === seasonId);
    if (!season) return show.episodes;
    return show.episodes.filter((episode) => episode.seasonNumber === season.indexNumber);
  }, [seasonId, show.episodes, show.seasons]);
  const selectedVersion =
    details.versions.find((version) => version.id === selection.versionId) ?? details.versions[0];
  const isPlayable = details.playable && (details.kind === 'movie' || details.kind === 'episode');
  const livePositionTicks = currentPlaybackPosition(playbackState, clockNowMs);
  const liveProgress = playbackProgress(playbackState, livePositionTicks);
  const detailsPlaybackState = playbackState?.itemId === details.id ? playbackState : undefined;
  const detailsPositionTicks = detailsPlaybackState
    ? livePositionTicks
    : details.playbackPositionTicks;
  const nativeResumePositionTicks = detailsPlaybackState
    ? detailsPlaybackState.positionTicks
    : details.playbackPositionTicks;
  const detailsProgress = detailsPlaybackState ? liveProgress : details.progress;
  const preparationTimedOut =
    detailsPlaybackState?.status === 'preparing' &&
    clockNowMs - detailsPlaybackState.startedAtMs >= PLAYBACK_PREPARATION_TIMEOUT_MS;
  const playbackLaunchPending =
    awaitingPlaybackAcknowledgement && requestedPlaybackState === undefined;
  const playbackIsActive =
    playbackLaunchPending ||
    (detailsPlaybackState?.status === 'preparing' && !preparationTimedOut) ||
    detailsPlaybackState?.status === 'playing' ||
    detailsPlaybackState?.status === 'paused';
  const playbackCompleted =
    detailsPlaybackState?.status === 'stopped' && detailsPlaybackState.stopReason === 'completed';
  const hasResumePosition = isPlayable && !playbackCompleted && nativeResumePositionTicks > 0;
  const isResumable = hasResumePosition && !playbackIsActive;
  const playableLabel = details.kind === 'movie' ? 'Movie' : 'Episode';
  const primaryPlaybackLabel = preparationTimedOut
    ? `Retry ${playableLabel}`
    : playbackLaunchPending || detailsPlaybackState?.status === 'preparing'
      ? `Starting ${playableLabel}`
      : detailsPlaybackState?.status === 'playing'
        ? `Playing ${playableLabel}`
        : detailsPlaybackState?.status === 'paused'
          ? `Paused ${playableLabel}`
          : isResumable
            ? `Resume ${playableLabel}`
            : `Play ${playableLabel}`;
  const primaryPlaybackDetail = playbackIsActive
    ? detailsPlaybackState?.durationTicks
      ? `${ticksToClock(detailsPositionTicks)} of ${ticksToClock(detailsPlaybackState.durationTicks)}`
      : undefined
    : isResumable
      ? detailsPlaybackState?.durationTicks
        ? `${ticksToClock(Math.max(0, detailsPlaybackState.durationTicks - detailsPositionTicks))} remaining`
        : details.progressLabel
      : undefined;

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
    setPlaybackAcknowledgementStartedAtMs(undefined);
    // The one-second extrapolation is presentation-only. Starting another
    // player must use the last exact position observed from mpv so buffering or
    // a non-1× playback speed cannot create a false resume offset.
    const startPositionTicks = startMode === 'resume' ? nativeResumePositionTicks : 0;
    try {
      const payload = playbackPayload(startPositionTicks, newWindow);
      const result = await bridge.request('playback.start', payload);
      if (result.status === 'confirmation-required') {
        setRequestedPlaybackId(undefined);
        setPlaybackAcknowledgementStartedAtMs(undefined);
        setConfirmation({
          reason: result.plan.transcodeReasons.length
            ? result.plan.transcodeReasons.join(', ')
            : 'Jellyfin needs to convert the video before it can play.',
          payload,
          confirmationId: result.confirmationId,
        });
      } else {
        setRequestedPlaybackId(result.playbackId);
        setPlaybackAcknowledgementStartedAtMs(Date.now());
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
    setRequestedPlaybackId(undefined);
    setPlaybackAcknowledgementStartedAtMs(undefined);
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
      setRequestedPlaybackId(result.playbackId);
      setPlaybackAcknowledgementStartedAtMs(Date.now());
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
            {detailsPositionTicks > 0 ? (
              <div className="season-progress">
                <span>
                  <span>Progress</span>
                  <span>
                    {playbackCompleted
                      ? 'Completed'
                      : detailsPlaybackState
                        ? 'Current playback'
                        : details.seasonProgressLabel}
                  </span>
                </span>
                <ProgressBar
                  className="progress-track"
                  label={`${Math.round(Math.min(1, Math.max(0, detailsProgress)) * 100)} percent watched`}
                  value={detailsProgress}
                />
              </div>
            ) : null}

            <div className="playback-actions">
              <button
                className={`primary-button play-button${
                  playbackIsActive ? ' play-button--active' : ''
                }`}
                type="button"
                disabled={busy || playbackIsActive}
                onClick={() => void requestPlayback(isResumable ? 'resume' : 'beginning')}
              >
                {busy ? (
                  <SpinnerGap className="spin" size={22} aria-hidden="true" />
                ) : (
                  <Play size={22} weight="fill" aria-hidden="true" />
                )}
                <span>
                  <strong>{primaryPlaybackLabel}</strong>
                  {primaryPlaybackDetail ? <small>{primaryPlaybackDetail}</small> : null}
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
                disabled={busy || playbackLaunchPending}
                onClick={() =>
                  void requestPlayback(hasResumePosition ? 'resume' : 'beginning', true)
                }
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
                disabled={busy || playbackLaunchPending}
                onChange={selectVersion}
              />
              <ChoiceRow
                icon={<SpeakerHigh size={20} aria-hidden="true" />}
                label="Audio"
                value={selection.audioTrackId}
                choices={selectedVersion?.audioTracks ?? []}
                disabled={busy || playbackLaunchPending}
                onChange={(audioTrackId) =>
                  setSelection((current) => ({ ...current, audioTrackId }))
                }
              />
              <ChoiceRow
                icon={<Subtitles size={20} aria-hidden="true" />}
                label="Subtitles"
                value={selection.subtitleTrackId}
                choices={selectedVersion?.subtitleTracks ?? []}
                disabled={busy || playbackLaunchPending}
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

        {detailsPlaybackState || notice ? (
          <p
            className={`playback-notice${
              detailsPlaybackState
                ? ` playback-notice--${preparationTimedOut ? 'error' : detailsPlaybackState.status}`
                : ''
            }`}
            role={
              detailsPlaybackState?.status === 'error' || preparationTimedOut ? 'alert' : 'status'
            }
            aria-live="polite"
            aria-atomic="true"
          >
            {preparationTimedOut ? (
              <Warning size={18} aria-hidden="true" />
            ) : detailsPlaybackState?.status === 'preparing' ? (
              <SpinnerGap className="spin" size={18} aria-hidden="true" />
            ) : detailsPlaybackState?.status === 'paused' ? (
              <Pause size={18} weight="fill" aria-hidden="true" />
            ) : detailsPlaybackState?.status === 'error' ? (
              <Warning size={18} aria-hidden="true" />
            ) : detailsPlaybackState?.status === 'playing' ? (
              <Play size={18} weight="fill" aria-hidden="true" />
            ) : (
              <Check size={18} weight="bold" aria-hidden="true" />
            )}
            {detailsPlaybackState
              ? preparationTimedOut
                ? 'IINA is taking longer than expected to start playback. You can try again.'
                : playbackStatusText(detailsPlaybackState, detailsPositionTicks)
              : notice}
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
            {visibleEpisodes.map((episode) => {
              const episodePlaybackState = preferredPlaybackState(playbackStates, episode.id);
              const episodePositionTicks = currentPlaybackPosition(
                episodePlaybackState,
                clockNowMs,
              );
              const episodeProgress =
                episodePlaybackState === undefined
                  ? episode.progress
                  : playbackProgress(episodePlaybackState, episodePositionTicks);
              return (
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
                    {typeof episodeProgress === 'number' ? (
                      <ProgressBar
                        className="episode-card__progress"
                        label={`${Math.round(Math.min(1, Math.max(0, episodeProgress)) * 100)} percent watched`}
                        value={episodeProgress}
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
              );
            })}
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
