import { FilmSlate, Pause, Play, Queue } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { Artwork } from '../catalog/Artwork';
import { ProgressBar } from '../components/ProgressBar';
import { createPlayerUiHost, type PlayerUiHost, type PlayerViewState } from './host';
import type { ChapterSkipMode } from './host';
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

const chapterSkipDescriptions: Record<ChapterSkipMode, string> = {
  on: 'Skips matching chapters automatically',
  prompt: 'Shows a skip button for ten seconds',
  off: 'Never skips chapters',
};

export function SidebarApp({ host: hostProp }: SidebarAppProps) {
  const [host] = useState(() => hostProp ?? createPlayerUiHost());
  const [playerState, setPlayerState] = useState<PlayerViewState | undefined>(() =>
    host.getPlayerState(),
  );
  useEffect(() => host.subscribePlayerState(setPlayerState), [host]);
  const [chapterSkipSettings, setChapterSkipSettings] = useState(() =>
    host.getChapterSkipSettings(),
  );
  useEffect(() => host.subscribeChapterSkipSettings(setChapterSkipSettings), [host]);

  const changeChapterSkipMode = (mode: ChapterSkipMode): void => {
    setChapterSkipSettings({ mode });
    void host.send('settings.chapterSkipMode', { mode });
  };

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

      <section className="chapter-skip-setting" aria-labelledby="chapter-skip-heading">
        <span>
          <strong id="chapter-skip-heading">Chapter skipping</strong>
          <small>{chapterSkipDescriptions[chapterSkipSettings.mode]}</small>
        </span>
        <select
          aria-label="Chapter skipping"
          value={chapterSkipSettings.mode}
          onChange={(event) => changeChapterSkipMode(event.currentTarget.value as ChapterSkipMode)}
        >
          <option value="on">On</option>
          <option value="prompt">Prompt</option>
          <option value="off">Off</option>
        </select>
      </section>

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
