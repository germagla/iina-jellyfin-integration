import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockBridge, NativeBridge } from '../src/bridge/client';
import type {
  BridgeOperation,
  BridgePayload,
  BridgeResultMap,
  ShowDetails,
} from '../src/bridge/contracts';
import {
  episodesFromResult,
  seasonsFromEpisodes,
  showDetailsFromResult,
} from '../src/bridge/adapters';
import { demoShowDetails } from '../src/demo/catalog';
import { CatalogApp } from '../src/catalog/CatalogApp';
import { safeArtworkSource } from '../src/catalog/Artwork';

afterEach(() => {
  vi.useRealTimers();
});

class RaceBridge extends MockBridge {
  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query') {
      const query = payload as BridgePayload<'catalog.query'>;
      if (query.kind === 'details' && query.itemId.startsWith('horizons-episode-')) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, query.itemId === 'horizons-episode-1' ? 70 : 5),
        );
      }
    }
    return super.request(operation, payload);
  }
}

const multiSeasonShow = {
  ...demoShowDetails,
  id: 'multi-season-series',
  seasons: [
    { id: 'season-index:1', label: 'Season 1', indexNumber: 1 },
    { id: 'season-index:2', label: 'Season 2', indexNumber: 2 },
  ],
  episodes: [
    demoShowDetails.episodes[0]!,
    {
      ...demoShowDetails.episodes[3]!,
      episodeNumber: 1,
      seasonNumber: 2,
      playbackPositionTicks: 2_222_222_222,
    },
  ],
} satisfies ShowDetails;

class MultiSeasonBridge extends MockBridge {
  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (
      operation === 'catalog.query' &&
      (payload as BridgePayload<'catalog.query'>).kind === 'details' &&
      (payload as { itemId?: string }).itemId === 'horizons-episode-4'
    ) {
      return {
        ...demoShowDetails,
        id: 'horizons-episode-4',
        episodeTitle: 'Echoes',
        episodeLabel: 'S2 · E1',
        playbackPositionTicks: 2_222_222_222,
      } as BridgeResultMap[K];
    }
    return super.request(operation, payload);
  }
}

describe('catalog journey', () => {
  it('requires explicit acknowledgement before password login to remote HTTP', async () => {
    const bridge = new MockBridge(false);
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected={false} initialRoute="home" />);

    await user.clear(screen.getByLabelText('Server address'));
    await user.type(screen.getByLabelText('Server address'), 'http://jellyfin.example.com/media');
    await user.type(screen.getByLabelText('Username'), 'alex');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    const warning = screen.getByRole('dialog', { name: 'This connection isn’t encrypted' });
    expect(within(warning).getByRole('button', { name: 'Continue' })).toBeDisabled();
    await user.click(within(warning).getByRole('checkbox'));
    await user.click(within(warning).getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument();
    expect(bridge.requests.map((request) => request.operation)).toContain('connection.probe');
    const login = bridge.requests.find(
      (request) => request.operation === 'connection.login.password',
    );
    expect(login?.payload).toMatchObject({
      allowInsecureRemote: true,
      serverUrl: 'http://jellyfin.example.com/media',
    });
  });

  it('warns about LAN HTTP without blocking a trusted local connection', async () => {
    const bridge = new MockBridge(false);
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected={false} />);

    await user.clear(screen.getByLabelText('Server address'));
    await user.type(screen.getByLabelText('Server address'), 'http://192.168.1.20:8096/jellyfin');
    expect(screen.getByRole('note')).toHaveTextContent('Local HTTP is unencrypted');
    await user.type(screen.getByLabelText('Username'), 'alex');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(screen.queryByRole('dialog', { name: 'This connection isn’t encrypted' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument();
  });

  it('shows the three home shelves', async () => {
    render(<CatalogApp bridge={new MockBridge()} initialConnected initialRoute="home" />);

    expect(await screen.findByRole('heading', { name: 'Continue Watching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next Up' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently Added' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Crossing Lines' })).toBeInTheDocument();
    const progress = screen.getByRole('progressbar', { name: '55 percent watched' });
    expect(progress).toHaveAttribute('value', '0.55');
    expect(progress).not.toHaveAttribute('style');
  });

  it('paginates and sorts a movie library', async () => {
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="movies" />);

    expect(await screen.findByText('The Quiet Orbit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Windward')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');
    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());
    expect(
      bridge.requests.some(
        (request) =>
          request.operation === 'catalog.query' &&
          request.payload.kind === 'library' &&
          request.payload.sortBy === 'SortName',
      ),
    ).toBe(true);
  });

  it('debounces search and ignores the pre-debounce interval', async () => {
    vi.useFakeTimers();
    const bridge = new MockBridge();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="search" />);
    const input = screen.getByRole('searchbox');

    fireEvent.change(input, { target: { value: 'Horizons' } });
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(
      bridge.requests.some(
        (request) => request.operation === 'catalog.query' && request.payload.kind === 'search',
      ),
    ).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Horizons')).toBeInTheDocument();
  });

  it('supports track choices, transcode confirmation, and opening a new window', async () => {
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Version'), 'source-4k');
    expect(screen.getByLabelText('Audio')).toHaveValue('6');
    expect(screen.getByLabelText('Subtitles')).toHaveValue('-1');
    expect(
      within(screen.getByLabelText('Audio')).queryByRole('option', { name: /Spanish/ }),
    ).toBeNull();
    await user.selectOptions(screen.getByLabelText('Audio'), '7');
    await user.selectOptions(screen.getByLabelText('Subtitles'), '8');
    await user.click(screen.getByRole('button', { name: /Resume Episode/ }));

    const modal = await screen.findByRole('dialog', { name: 'Video conversion required' });
    expect(modal).toHaveTextContent('re-encode the video');
    await user.click(within(modal).getByRole('button', { name: 'Convert and Play' }));
    expect(await screen.findByText('Starting converted playback in IINA…')).toBeInTheDocument();

    const initialStart = bridge.requests.find((request) => request.operation === 'playback.start');
    expect(initialStart?.payload).toMatchObject({
      mediaSourceId: 'source-4k',
      audioStreamIndex: 7,
      subtitleStreamIndex: 8,
      openInNewWindow: false,
      startPositionTicks: 14_520_000_000,
    });

    await user.selectOptions(screen.getByLabelText('Version'), 'source-1080');
    expect(screen.getByLabelText('Audio')).toHaveValue('1');
    expect(screen.getByLabelText('Subtitles')).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: 'Open in New Window' }));
    expect(await screen.findByText('Opening in a new IINA window…')).toBeInTheDocument();
    expect(
      bridge.requests.some(
        (request) =>
          request.operation === 'playback.start' && request.payload.openInNewWindow === true,
      ),
    ).toBe(true);
  });

  it('preserves new-window intent while confirming a video transcode', async () => {
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Version'), 'source-4k');
    await user.click(screen.getByRole('button', { name: 'Open in New Window' }));
    const modal = await screen.findByRole('dialog', { name: 'Video conversion required' });
    await user.click(within(modal).getByRole('button', { name: 'Convert and Play' }));

    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({
      openInNewWindow: true,
      videoTranscodeApproved: true,
      mediaSourceId: 'source-4k',
      startPositionTicks: 14_520_000_000,
    });
    expect(
      await screen.findByText('Opening converted playback in a new IINA window…'),
    ).toBeInTheDocument();
  });

  it('opens catalog confirmation for an Up Next video transcode event', async () => {
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="home" />);

    act(() => {
      bridge.emitPlaybackConfirmation({
        itemId: 'horizons-episode-4',
        source: 'up-next',
        openInNewWindow: true,
        plan: {
          playMethod: 'Transcode',
          conversion: 'video',
          requiresVideoTranscodeConfirmation: true,
          transcodeReasons: ['VideoCodecNotSupported'],
          mediaSourceId: 'source-4k',
          audioStreamIndex: 6,
          subtitleStreamIndex: -1,
        },
      });
    });

    const modal = await screen.findByRole('dialog', { name: 'Video conversion required' });
    await user.click(within(modal).getByRole('button', { name: 'Convert and Play' }));
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({
      itemId: 'horizons-episode-4',
      startPositionTicks: 0,
      mediaSourceId: 'source-4k',
      audioStreamIndex: 6,
      subtitleStreamIndex: -1,
      openInNewWindow: true,
      videoTranscodeApproved: true,
    });
  });

  it('ignores stale episode detail responses after a faster later selection', async () => {
    const user = userEvent.setup();
    render(
      <CatalogApp
        bridge={new RaceBridge()}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );

    await user.click(screen.getByRole('button', { name: /1\. Contact/ }));
    await user.click(screen.getByRole('button', { name: /2\. Afterglow/ }));
    expect(screen.getAllByText('S1 · E2 · Afterglow').length).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    });
    expect(screen.getAllByText('S1 · E2 · Afterglow').length).toBeGreaterThan(0);
    expect(screen.queryByText('S1 · E1 · Contact')).toBeNull();
  });

  it('changes seasons to the first episode with Jellyfin-provided numbering', async () => {
    const bridge = new MultiSeasonBridge();
    const user = userEvent.setup();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={multiSeasonShow}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Season' }), 'season-index:2');
    expect(screen.queryByRole('button', { name: /Contact/ })).toBeNull();
    expect(await screen.findByRole('button', { name: /1\. Echoes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByText('S2 · E1 · Echoes').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Resume Episode/ }));
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({
      itemId: 'horizons-episode-4',
      startPositionTicks: 2_222_222_222,
    });
  });

  it('renders hostile Jellyfin metadata as inert React text', () => {
    const hostile = {
      ...demoShowDetails,
      title: '<img src="x" onerror="window.pwned=true">',
      overview: '<script>window.pwned=true</script>',
      heroArtwork: 'javascript:alert(1)',
    };
    const { container } = render(
      <CatalogApp
        bridge={new MockBridge()}
        initialConnected
        initialRoute="details"
        showOverride={hostile}
      />,
    );

    expect(screen.getByRole('heading', { name: hostile.title })).toBeInTheDocument();
    expect(screen.getByText(hostile.overview)).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src^="javascript:"]')).toBeNull();
  });

  it.each([
    ['loading', 'Loading catalog'],
    ['empty', 'Your library is quiet'],
    ['error', 'Couldn’t load your library'],
  ] as const)('renders the %s catalog state', async (state, accessibleText) => {
    render(
      <CatalogApp
        bridge={new MockBridge()}
        initialConnected
        initialRoute="home"
        demoState={state}
      />,
    );
    if (state === 'loading') expect(screen.getByLabelText(accessibleText)).toBeInTheDocument();
    else expect(await screen.findByText(accessibleText)).toBeInTheDocument();
  });
});

describe('Jellyfin item adapters', () => {
  const mediaSources = [
    {
      Id: 'source-a',
      Name: 'Source A',
      DefaultAudioStreamIndex: 2,
      DefaultSubtitleStreamIndex: 5,
      MediaStreams: [
        { Index: 2, Type: 'Audio', DisplayTitle: 'English', IsDefault: true },
        { Index: 5, Type: 'Subtitle', DisplayTitle: 'English SDH', IsDefault: true },
      ],
    },
    {
      Id: 'source-b',
      Name: 'Source B',
      MediaStreams: [
        { Index: 9, Type: 'Audio', DisplayTitle: 'Japanese', IsDefault: true },
        { Index: 10, Type: 'Subtitle', DisplayTitle: 'Japanese' },
      ],
    },
  ];
  const episode = {
    Id: 'episode-8',
    Name: 'Real Numbering',
    Type: 'Episode',
    SeriesId: 'series-1',
    SeriesName: 'Example Series',
    ParentIndexNumber: 3,
    IndexNumber: 8,
    RunTimeTicks: 27_000_000_000,
    UserData: { PlaybackPositionTicks: 1_234_567_890, PlayedPercentage: 4.57 },
    MediaSources: mediaSources,
  };

  it('retains exact resume ticks and source-specific track defaults', () => {
    const details = showDetailsFromResult(episode);

    expect(details.playbackPositionTicks).toBe(1_234_567_890);
    expect(details.episodeLabel).toBe('S3 · E8');
    expect(details.versions[0]).toMatchObject({
      id: 'source-a',
      defaultAudioTrackId: '2',
      defaultSubtitleTrackId: '5',
    });
    expect(details.versions[1]).toMatchObject({
      id: 'source-b',
      defaultAudioTrackId: '9',
      defaultSubtitleTrackId: '-1',
    });
    expect(details.versions[1]?.audioTracks.map((track) => track.id)).toEqual(['9']);
  });

  it('uses Jellyfin episode and season indexes instead of list positions', () => {
    const episodes = episodesFromResult({
      Items: [episode, { ...episode, Id: 'episode-2', ParentIndexNumber: 5, IndexNumber: 2 }],
      TotalRecordCount: 2,
      StartIndex: 0,
    });

    expect(
      episodes.map(({ seasonNumber, episodeNumber }) => [seasonNumber, episodeNumber]),
    ).toEqual([
      [3, 8],
      [5, 2],
    ]);
    expect(seasonsFromEpisodes(episodes)).toEqual([
      { id: 'season-index:3', label: 'Season 3', indexNumber: 3 },
      { id: 'season-index:5', label: 'Season 5', indexNumber: 5 },
    ]);
  });
});

describe('native catalog events', () => {
  it('validates operation-specific bridge results before resolving webview requests', async () => {
    const handlers = new Map<string, (message: unknown) => void>();
    const postMessage = vi.fn();
    const bridge = new NativeBridge({
      postMessage,
      onMessage: (name, handler) => handlers.set(name, handler),
    });
    const pending = bridge.request('connection.disconnect', {});
    const envelope = postMessage.mock.calls[0]?.[1] as { requestId: string };

    handlers.get('bridge.response')?.({
      operation: 'connection.disconnect',
      requestId: envelope.requestId,
      ok: true,
      result: { disconnected: true, accessToken: 'must-not-cross' },
    });

    await expect(pending).rejects.toThrow('invalid Jellyfin response');
  });

  it('queues, validates, and strips unknown fields from Up Next confirmations', () => {
    const handlers = new Map<string, (message: unknown) => void>();
    const bridge = new NativeBridge({
      postMessage: vi.fn(),
      onMessage: (name, handler) => handlers.set(name, handler),
    });
    handlers.get('playback.confirmation-required')?.({
      itemId: 'episode-4',
      source: 'up-next',
      openInNewWindow: false,
      accessToken: 'must-not-cross-the-bridge',
      plan: {
        playMethod: 'Transcode',
        conversion: 'video',
        requiresVideoTranscodeConfirmation: true,
        transcodeReasons: ['VideoCodecNotSupported'],
        mediaSourceId: 'source-4k',
      },
    });

    const listener = vi.fn();
    bridge.subscribePlaybackConfirmation(listener);
    expect(listener).toHaveBeenCalledWith({
      itemId: 'episode-4',
      source: 'up-next',
      openInNewWindow: false,
      plan: {
        playMethod: 'Transcode',
        conversion: 'video',
        requiresVideoTranscodeConfirmation: true,
        transcodeReasons: ['VideoCodecNotSupported'],
        mediaSourceId: 'source-4k',
      },
    });

    handlers.get('playback.confirmation-required')?.({
      itemId: 'episode-4',
      source: 'up-next',
      openInNewWindow: true,
      plan: {
        playMethod: 'Transcode',
        conversion: 'video',
        requiresVideoTranscodeConfirmation: true,
        transcodeReasons: [],
        mediaSourceId: 'source-4k',
        url: 'https://example.invalid/video?ApiKey=secret',
      },
    });
    expect(listener.mock.calls[1]?.[0]).toEqual({
      itemId: 'episode-4',
      source: 'up-next',
      openInNewWindow: true,
      plan: {
        playMethod: 'Transcode',
        conversion: 'video',
        requiresVideoTranscodeConfirmation: true,
        transcodeReasons: [],
        mediaSourceId: 'source-4k',
      },
    });
    handlers.get('playback.confirmation-required')?.({ itemId: '', source: 'up-next', plan: {} });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('artwork broker output validation', () => {
  it('allows bounded raster data URLs and safe relative images only', () => {
    expect(safeArtworkSource('../../demo/horizons-hero.png')).toBe('../../demo/horizons-hero.png');
    expect(safeArtworkSource('data:image/png;base64,aGVsbG8=')).toBe(
      'data:image/png;base64,aGVsbG8=',
    );
    expect(safeArtworkSource('data:image/svg+xml,<svg onload=alert(1)>')).toBeUndefined();
    expect(safeArtworkSource('javascript:alert(1)')).toBeUndefined();
    expect(safeArtworkSource('../../token.txt')).toBeUndefined();
  });
});
