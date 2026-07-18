import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  MockPlayerUiHost,
  parseChapterSkip,
  parseChapterSkipSettings,
  parsePlayerState,
  parseUpNext,
  reportPlayerWebviewError,
  type ChapterSkipViewState,
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

const openingPrompt: ChapterSkipViewState = {
  generation: 3,
  chapterIndex: 0,
  title: 'Opening',
  expiresAtMs: 1_800_000_010_000,
};

describe('contextual player surfaces', () => {
  it('keeps unsupported Up Next controls out of the production sidebar', async () => {
    const host = new MockPlayerUiHost({ upNext: nextEpisode });
    const user = userEvent.setup();
    render(<SidebarApp host={host} />);

    expect(screen.queryByText('Up Next')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pause playback' }));

    expect(host.messages.map((message) => message.action)).toContain('player.pause');
    expect(host.messages.some((message) => message.action.startsWith('upNext.'))).toBe(false);
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

  it('renders a bounded clickable chapter prompt and sends no seek destination', async () => {
    const host = new MockPlayerUiHost({ upNext: undefined, chapterSkip: openingPrompt });
    const user = userEvent.setup();
    render(<OverlayApp host={host} />);

    const skip = screen.getByRole('button', { name: 'Skip Opening' });
    expect(screen.getByRole('status')).toHaveTextContent('Skip Opening is available');
    expect(skip).toHaveAttribute('data-clickable');
    expect(document.querySelectorAll('[data-clickable]')).toHaveLength(1);
    const icon = skip.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(window.getComputedStyle(icon as SVGElement).pointerEvents).toBe('none');
    const label = skip.querySelector('.overlay-skip-label');
    expect(label).not.toBeNull();
    expect(window.getComputedStyle(label as HTMLElement).textOverflow).toBe('ellipsis');
    await user.click(skip);

    expect(host.messages).toContainEqual({
      action: 'chapterSkip.skip',
      payload: { generation: 3, chapterIndex: 0 },
    });
  });

  it('gives Up Next priority over a chapter prompt', () => {
    const host = new MockPlayerUiHost({ upNext: nextEpisode, chapterSkip: openingPrompt });
    render(<OverlayApp host={host} />);

    expect(screen.getByText('Up Next in 9')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip Opening' })).not.toBeInTheDocument();
  });

  it('exposes and persists the three-state chapter setting from the sidebar', async () => {
    const host = new MockPlayerUiHost({
      chapterSkipSettings: { mode: 'prompt' },
    });
    const user = userEvent.setup();
    render(<SidebarApp host={host} />);

    const mode = screen.getByRole('combobox', { name: 'Chapter skipping' });
    expect(mode).toHaveValue('prompt');
    await user.selectOptions(mode, 'on');

    expect(host.messages).toContainEqual({
      action: 'settings.chapterSkipMode',
      payload: { mode: 'on' },
    });
    act(() => host.emitChapterSkipSettings({ mode: 'off' }));
    expect(mode).toHaveValue('off');
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
  it('does not forward webview URLs or metadata into native diagnostics', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'iina', {
      configurable: true,
      value: { postMessage },
    });

    reportPlayerWebviewError(
      'sidebar',
      'unhandledrejection',
      new TypeError('Widow Bay failed at https://media.test/Videos/private-item/stream'),
    );

    expect(postMessage).toHaveBeenCalledWith('host.action', {
      action: 'host.webviewError',
      surface: 'sidebar',
      kind: 'unhandledrejection',
      message: 'TypeError',
    });
    expect(JSON.stringify(postMessage.mock.calls)).not.toContain('Widow Bay');
    expect(JSON.stringify(postMessage.mock.calls)).not.toContain('https://');
  });

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
    expect(
      parseChapterSkip({
        generation: 3,
        chapterIndex: 0,
        title: 'Opening',
        expiresAtMs: 1_800_000_010_000,
        targetSeconds: 90,
        Authorization: 'secret',
      }),
    ).toEqual(openingPrompt);
    expect(parseChapterSkip({ ...openingPrompt, title: 'x'.repeat(129) })).toBeUndefined();
    expect(parseChapterSkipSettings({ mode: 'prompt' })).toEqual({ mode: 'prompt' });
    expect(parseChapterSkipSettings({ mode: 'automatic' })).toBeUndefined();
  });
});
