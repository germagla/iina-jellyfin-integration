import { FilmSlate, Pause, Play, Queue, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Artwork } from '../catalog/Artwork';
import { ProgressBar } from '../components/ProgressBar';
import { createPlayerUiHost, type PlayerUiHost, type PlayerViewState } from './host';
import { useUpNext } from './useUpNext';
import './sidebar.css';

export interface SidebarAppProps {
  host?: PlayerUiHost;
}

function ticksToClock(ticks: number | undefined): string {
  if (ticks === undefined || !Number.isFinite(ticks)) return '0:00';
  const seconds = Math.max(0, Math.floor(ticks / 10_000_000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function episodeContext(state: {
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}): string | undefined {
  const episode =
    state.seasonNumber !== undefined && state.episodeNumber !== undefined
      ? `S${state.seasonNumber} · E${state.episodeNumber}`
      : undefined;
  return [state.seriesName, episode].filter(Boolean).join(' · ') || undefined;
}

export function SidebarApp({ host: hostProp }: SidebarAppProps) {
  const [host] = useState(() => hostProp ?? createPlayerUiHost());
  const [playerState, setPlayerState] = useState<PlayerViewState | undefined>(() =>
    host.getPlayerState(),
  );
  const upNext = useUpNext(host);

  useEffect(() => host.subscribePlayerState(setPlayerState), [host]);

  const progress = useMemo(() => {
    if (!playerState?.durationTicks) return 0;
    return Math.min(
      100,
      Math.max(0, (playerState.positionTicks / playerState.durationTicks) * 100),
    );
  }, [playerState]);
  const remainingTicks = Math.max(
    0,
    (playerState?.durationTicks ?? 0) - (playerState?.positionTicks ?? 0),
  );
  const paused = playerState?.status === 'paused';
  const currentContext = playerState ? episodeContext(playerState) : undefined;
  const nextContext = upNext.upNext ? episodeContext(upNext.upNext) : undefined;

  return (
    <main className="sidebar-shell">
      <header className="sidebar-heading">
        <div>
          <p>Jellyfin</p>
          <h1>Now Playing</h1>
        </div>
        <button
          className="sidebar-icon-button"
          type="button"
          aria-label="Open Jellyfin library"
          onClick={() => void host.send('window.openCatalog')}
        >
          <Queue size={20} aria-hidden="true" />
        </button>
      </header>

      <section className="now-playing-card" aria-labelledby="now-playing-title">
        <span className="now-playing-artwork">
          {playerState?.artwork ? (
            <Artwork source={playerState.artwork} alt="" className="now-playing-image" />
          ) : (
            <span className="player-artwork-empty" aria-hidden="true">
              <FilmSlate size={40} weight="duotone" />
            </span>
          )}
          {playerState?.status === 'playing' || playerState?.status === 'paused' ? (
            <button
              className="center-play-button"
              type="button"
              onClick={() => void host.send(paused ? 'player.resume' : 'player.pause')}
              aria-label={paused ? 'Resume playback' : 'Pause playback'}
            >
              {paused ? (
                <Play size={21} weight="fill" aria-hidden="true" />
              ) : (
                <Pause size={21} weight="fill" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </span>
        <div className="now-playing-copy">
          <p>{playerState?.seriesName ?? playerState?.playMethod ?? 'Jellyfin'}</p>
          <h2 id="now-playing-title">{playerState?.title ?? 'Nothing playing'}</h2>
          <span>{currentContext ?? 'Choose something from your library.'}</span>
        </div>
        <ProgressBar
          className="sidebar-progress"
          label={`${Math.round(progress)} percent played`}
          max={100}
          value={progress}
        />
        <div className="time-row">
          <span>{ticksToClock(playerState?.positionTicks)}</span>
          <span>{remainingTicks > 0 ? `−${ticksToClock(remainingTicks)}` : '0:00'}</span>
        </div>
      </section>

      <section className="up-next-card" aria-labelledby="up-next-title">
        {upNext.upNext ? (
          <>
            <div className="up-next-heading">
              <div>
                <p>Up Next</p>
                <h2 id="up-next-title">{upNext.upNext.title}</h2>
                <span>{nextContext}</span>
              </div>
              {upNext.upNext.autoplay ? (
                <strong aria-label={`${upNext.upNext.remainingSeconds} seconds remaining`}>
                  {upNext.upNext.remainingSeconds}
                </strong>
              ) : null}
            </div>
            {upNext.upNext.artwork ? (
              <Artwork source={upNext.upNext.artwork} alt="" className="up-next-image" />
            ) : (
              <span className="up-next-image player-artwork-empty" aria-hidden="true">
                <FilmSlate size={32} weight="duotone" />
              </span>
            )}
            {upNext.error ? (
              <p className="countdown-error" role="alert">
                {upNext.error}
              </p>
            ) : null}
            <div className="up-next-actions">
              <button
                className="sidebar-primary-button"
                type="button"
                disabled={upNext.status === 'starting' || upNext.status === 'started'}
                onClick={() => void upNext.playNow()}
              >
                <Play size={17} weight="fill" aria-hidden="true" />
                {upNext.status === 'starting' ? 'Starting…' : 'Play Now'}
              </button>
              <button
                className="sidebar-secondary-button"
                type="button"
                onClick={() => void upNext.cancel()}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="up-next-empty">
            <p>Up Next</p>
            <h2 id="up-next-title">
              {upNext.cancelled ? 'Autoplay cancelled' : 'No episode queued'}
            </h2>
            {upNext.cancelled ? <X size={18} aria-hidden="true" /> : null}
          </div>
        )}
      </section>

      <label className="autoplay-setting">
        <span>
          <strong>Play next episode</strong>
          <small>Start automatically when the countdown ends.</small>
        </span>
        <input
          type="checkbox"
          checked={upNext.upNext?.autoplay ?? false}
          onChange={(event) => upNext.changeAutoplay(event.target.checked)}
        />
      </label>

      <button
        className="open-library-button"
        type="button"
        onClick={() => void host.send('window.openCatalog')}
      >
        Open Library
      </button>
    </main>
  );
}
