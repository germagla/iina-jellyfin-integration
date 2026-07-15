import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  MockPlayerUiHost,
  parsePlayerState,
  parseUpNext,
  type UpNextViewState,
} from '../src/sidebar/host';
import { OverlayApp } from '../src/sidebar/OverlayApp';
import { SidebarApp } from '../src/sidebar/SidebarApp';

const nextEpisode: UpNextViewState = {
  itemId: 'episode-4',
  title: 'Echoes',
  seriesName: 'Horizons',
  seasonNumber: 1,
  episodeNumber: 4,
  remainingSeconds: 9,
  autoplay: true,
};

describe('contextual player surfaces', () => {
  it('uses the runtime host protocol for playback, cancellation, and autoplay', async () => {
    const host = new MockPlayerUiHost({ upNext: nextEpisode });
    const user = userEvent.setup();
    render(<SidebarApp host={host} />);

    expect(screen.getByLabelText('9 seconds remaining')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause playback' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Autoplay cancelled' })).toBeInTheDocument();

    expect(host.messages.map((message) => message.action)).toEqual(
      expect.arrayContaining(['player.pause', 'upNext.cancel']),
    );
  });

  it('renders host-driven countdown updates and sends play-now from the overlay', async () => {
    const host = new MockPlayerUiHost({ upNext: nextEpisode });
    const user = userEvent.setup();
    render(<OverlayApp host={host} />);

    expect(screen.getByText('Up Next in 9')).toBeInTheDocument();
    act(() => host.emitUpNext({ ...nextEpisode, remainingSeconds: 2 }));
    expect(screen.getByText('Up Next in 2')).toBeInTheDocument();

    const playNow = screen.getByRole('button', { name: 'Play Now' });
    expect(playNow).toHaveAttribute('data-clickable');
    await user.click(playNow);
    expect(host.messages.some((message) => message.action === 'upNext.playNow')).toBe(true);
  });

  it('reacts to authoritative player state updates', () => {
    const host = new MockPlayerUiHost({ upNext: nextEpisode });
    render(<SidebarApp host={host} />);

    act(() =>
      host.emitPlayerState({
        generation: 2,
        status: 'paused',
        positionTicks: 600_000_000,
        durationTicks: 1_200_000_000,
        title: 'Echoes',
        seriesName: 'Horizons',
        seasonNumber: 1,
        episodeNumber: 4,
        playMethod: 'DirectStream',
      }),
    );

    expect(document.querySelector('#now-playing-title')).toHaveTextContent('Echoes');
    expect(screen.getByRole('button', { name: 'Resume playback' })).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: '50 percent played' });
    expect(progress).toHaveAttribute('max', '100');
    expect(progress).toHaveAttribute('value', '50');
    expect(progress).not.toHaveAttribute('style');
  });
});

describe('player message validation', () => {
  it('rejects malformed or secret-shaped player messages', () => {
    expect(parsePlayerState({ status: 'playing', positionTicks: 0 })).toBeUndefined();
    expect(
      parseUpNext({
        itemId: 'episode',
        title: 'Echoes',
        remainingSeconds: 10,
        autoplay: true,
        Authorization: 'secret',
      }),
    ).toEqual({
      itemId: 'episode',
      title: 'Echoes',
      remainingSeconds: 10,
      autoplay: true,
    });
  });
});
