import { FilmSlate, Play, SpinnerGap } from '@phosphor-icons/react';
import { useState } from 'react';
import { Artwork } from '../catalog/Artwork';
import { createPlayerUiHost, type PlayerUiHost } from './host';
import { useUpNext } from './useUpNext';
import './overlay.css';

export interface OverlayAppProps {
  host?: PlayerUiHost;
}

export function OverlayApp({ host: hostProp }: OverlayAppProps) {
  const [host] = useState(() => hostProp ?? createPlayerUiHost());
  const upNext = useUpNext(host);

  if (upNext.upNext === undefined) return null;

  const episode =
    upNext.upNext.seasonNumber !== undefined && upNext.upNext.episodeNumber !== undefined
      ? `S${upNext.upNext.seasonNumber} E${upNext.upNext.episodeNumber}`
      : undefined;
  const context = [upNext.upNext.seriesName, episode].filter(Boolean).join(' · ');

  return (
    <main className="overlay-shell" aria-labelledby="overlay-up-next-title">
      {upNext.upNext.artwork ? (
        <Artwork source={upNext.upNext.artwork} alt="" className="overlay-artwork" />
      ) : (
        <span className="overlay-artwork player-artwork-empty" aria-hidden="true">
          <FilmSlate size={32} weight="duotone" />
        </span>
      )}
      <section className="overlay-copy">
        <p>{upNext.upNext.autoplay ? `Up Next in ${upNext.upNext.remainingSeconds}` : 'Up Next'}</p>
        <h1 id="overlay-up-next-title">{upNext.upNext.title}</h1>
        <span>{context}</span>
        {upNext.error ? (
          <button
            className="overlay-link"
            data-clickable
            type="button"
            onClick={() => void host.send('window.openCatalog')}
          >
            {upNext.error}
          </button>
        ) : null}
      </section>
      <div className="overlay-actions">
        <button
          className="overlay-play"
          data-clickable
          type="button"
          disabled={upNext.status === 'starting'}
          onClick={() => void upNext.playNow()}
        >
          {upNext.status === 'starting' ? (
            <SpinnerGap className="overlay-spin" size={17} aria-hidden="true" />
          ) : (
            <Play size={17} weight="fill" aria-hidden="true" />
          )}
          {upNext.status === 'starting' ? 'Starting…' : 'Play Now'}
        </button>
        <button
          className="overlay-cancel"
          data-clickable
          type="button"
          onClick={() => void upNext.cancel()}
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
