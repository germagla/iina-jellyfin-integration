import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockBridge, NativeBridge } from '../src/bridge/client';
import type {
  BridgeOperation,
  BridgePayload,
  BridgeResultMap,
  PublicPlaybackState,
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
import { GridScreen, HomeScreen, SearchScreen } from '../src/catalog/LibraryScreens';

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function rect(width: number, top = 0, height = 200): DOMRect {
  return {
    x: 0,
    y: top,
    width,
    height,
    top,
    right: width,
    bottom: top + height,
    left: 0,
    toJSON: () => ({}),
  };
}

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

class SlowQuickConnectBridge extends MockBridge {
  pollCount = 0;

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'connection.quickConnect.poll') {
      this.pollCount += 1;
      return new Promise<BridgeResultMap[K]>(() => undefined);
    }
    return super.request(operation, payload);
  }
}

class MultipleLibrariesBridge extends MockBridge {
  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query' && (payload as { kind?: string }).kind === 'libraries') {
      return {
        Items: [
          { Id: 'anime', Name: 'Anime', Type: 'CollectionFolder', CollectionType: 'tvshows' },
          { Id: 'films', Name: 'Films', Type: 'CollectionFolder', CollectionType: 'movies' },
          { Id: 'kids-tv', Name: 'Kids TV', Type: 'CollectionFolder', CollectionType: 'tvshows' },
          { Id: 'music', Name: 'Music', Type: 'CollectionFolder', CollectionType: 'music' },
        ],
        TotalRecordCount: 4,
        StartIndex: 0,
      } as BridgeResultMap[K];
    }
    return super.request(operation, payload);
  }
}

class LongHomeBridge extends MockBridge {
  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query') {
      const query = payload as BridgePayload<'catalog.query'>;
      if (query.kind === 'home') {
        const label =
          query.shelf === 'continueWatching'
            ? 'Continue Watching'
            : query.shelf === 'nextUp'
              ? 'Next Up'
              : 'Recently Added';
        return {
          Items: Array.from({ length: 20 }, (_, index) => ({
            Id: `${query.shelf}-${index + 1}`,
            Name: `${label} ${index + 1}`,
            Type: 'Movie',
          })),
          TotalRecordCount: 20,
          StartIndex: 0,
        } as BridgeResultMap[K];
      }
    }
    return super.request(operation, payload);
  }
}

class ChangingHomeBridge extends LongHomeBridge {
  private itemCount?: number;

  reduceShelves(): void {
    this.itemCount = 2;
  }

  emptyShelves(): void {
    this.itemCount = 0;
  }

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (this.itemCount !== undefined && operation === 'catalog.query') {
      const query = payload as BridgePayload<'catalog.query'>;
      if (query.kind === 'home') {
        const label =
          query.shelf === 'continueWatching'
            ? 'Continue Watching'
            : query.shelf === 'nextUp'
              ? 'Next Up'
              : 'Recently Added';
        return {
          Items: Array.from({ length: this.itemCount }, (_, index) => ({
            Id: `${query.shelf}-${index + 1}`,
            Name: `${label} ${index + 1}`,
            Type: 'Movie',
          })),
          TotalRecordCount: this.itemCount,
          StartIndex: 0,
        } as BridgeResultMap[K];
      }
    }
    return super.request(operation, payload);
  }
}

type PausedCatalogKind = Extract<
  BridgePayload<'catalog.query'>,
  { kind: 'home' | 'library' | 'search' }
>['kind'];

class PausableCatalogBridge extends MockBridge {
  private gate?: ReturnType<typeof deferred<void>>;
  private pausedKinds = new Set<PausedCatalogKind>();
  private failWhenReleased = false;

  pause(kinds: PausedCatalogKind[], failWhenReleased = false): void {
    this.gate = deferred<void>();
    this.pausedKinds = new Set(kinds);
    this.failWhenReleased = failWhenReleased;
  }

  release(): void {
    const gate = this.gate;
    this.gate = undefined;
    gate?.resolve();
  }

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query') {
      const query = payload as BridgePayload<'catalog.query'>;
      const gate = this.gate;
      if (
        gate !== undefined &&
        (query.kind === 'home' || query.kind === 'library' || query.kind === 'search') &&
        this.pausedKinds.has(query.kind)
      ) {
        await gate.promise;
        if (this.failWhenReleased) throw new Error('The Jellyfin server is temporarily offline.');
      }
    }
    return super.request(operation, payload);
  }
}

class SequencedSearchBridge extends MockBridge {
  searchRequests = 0;
  private readonly older = deferred<BridgeResultMap['catalog.query']>();
  private readonly newer = deferred<BridgeResultMap['catalog.query']>();

  resolveOlder(): void {
    this.older.resolve({
      Items: [{ Id: 'stale-result', Name: 'Stale Result', Type: 'Movie' }],
      TotalRecordCount: 1,
      StartIndex: 0,
    });
  }

  resolveNewer(): void {
    this.newer.resolve({
      Items: [{ Id: 'fresh-result', Name: 'Fresh Result', Type: 'Movie' }],
      TotalRecordCount: 1,
      StartIndex: 0,
    });
  }

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query' && (payload as { kind?: string }).kind === 'search') {
      this.searchRequests += 1;
      if (this.searchRequests > 1) {
        await super.request(operation, payload);
        return (this.searchRequests === 2 ? this.older.promise : this.newer.promise) as Promise<
          BridgeResultMap[K]
        >;
      }
    }
    return super.request(operation, payload);
  }
}

class ShrinkingLibraryBridge extends MockBridge {
  private isShrunk = false;

  shrink(): void {
    this.isShrunk = true;
  }

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (
      this.isShrunk &&
      operation === 'catalog.query' &&
      (payload as { kind?: string }).kind === 'library'
    ) {
      await super.request(operation, payload);
      const query = payload as BridgePayload<'catalog.query'> & { kind: 'library' };
      return {
        Items:
          query.startIndex === 0
            ? Array.from({ length: 5 }, (_, index) => ({
                Id: `remaining-${index + 1}`,
                Name: `Remaining ${index + 1}`,
                Type: 'Movie',
              }))
            : [],
        TotalRecordCount: 5,
        StartIndex: query.startIndex,
      } as BridgeResultMap[K];
    }
    return super.request(operation, payload);
  }
}

class EmptySeriesBridge extends MockBridge {
  episodeRequests = 0;

  override async request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]> {
    if (operation === 'catalog.query') {
      const query = payload as BridgePayload<'catalog.query'>;
      if (query.kind === 'details') {
        return {
          Id: 'series-without-media',
          Name: 'MARRIAGETOXIN',
          Type: 'Series',
          RunTimeTicks: 14_400_000_000,
          UserData: { PlaybackPositionTicks: 2_000_000_000, PlayedPercentage: 20 },
          MediaSources: [{ Id: 'not-a-playable-series-source', MediaStreams: [] }],
        } as BridgeResultMap[K];
      }
      if (query.kind === 'episodes') {
        this.episodeRequests += 1;
        return {
          Items: [
            {
              Id: `virtual-${query.startIndex}`,
              Name: 'Missing episode',
              Type: 'Episode',
              LocationType: 'Virtual',
            },
          ],
          TotalRecordCount: Number.MAX_SAFE_INTEGER,
          StartIndex: query.startIndex,
        } as BridgeResultMap[K];
      }
    }
    return super.request(operation, payload);
  }
}

describe('catalog journey', () => {
  it('starts with the standard local Jellyfin address', () => {
    render(<CatalogApp bridge={new MockBridge(false)} initialConnected={false} />);

    expect(screen.getByLabelText('Server address')).toHaveValue('http://localhost:8096');
    expect(screen.getByRole('note')).toHaveTextContent('Local HTTP is unencrypted');
  });

  it('accepts a bare localhost address and submits one canonical URL', async () => {
    const bridge = new MockBridge(false);
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected={false} />);

    await user.clear(screen.getByLabelText('Server address'));
    await user.type(screen.getByLabelText('Server address'), 'localhost:8096/jellyfin/');
    await user.type(screen.getByLabelText('Username'), 'alex');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(await screen.findByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument();
    expect(
      bridge.requests.filter(
        (request) =>
          request.operation === 'connection.probe' ||
          request.operation === 'connection.login.password',
      ),
    ).toEqual([
      expect.objectContaining({
        operation: 'connection.probe',
        payload: {
          serverUrl: 'http://localhost:8096/jellyfin',
          allowInsecureRemote: false,
        },
      }),
      expect.objectContaining({
        operation: 'connection.login.password',
        payload: {
          serverUrl: 'http://localhost:8096/jellyfin',
          username: 'alex',
          password: 'password',
          allowInsecureRemote: false,
        },
      }),
    ]);
  });

  it('normalizes a bare localhost address before starting Quick Connect', async () => {
    const bridge = new MockBridge(false);
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected={false} />);

    await user.clear(screen.getByLabelText('Server address'));
    await user.type(screen.getByLabelText('Server address'), 'localhost:8096');
    await user.click(screen.getByRole('button', { name: 'Quick Connect' }));

    expect(await screen.findByText('842916')).toBeInTheDocument();
    expect(
      bridge.requests.filter(
        (request) =>
          request.operation === 'connection.probe' ||
          request.operation === 'connection.quickConnect.start',
      ),
    ).toEqual([
      expect.objectContaining({
        operation: 'connection.probe',
        payload: { serverUrl: 'http://localhost:8096', allowInsecureRemote: false },
      }),
      expect.objectContaining({
        operation: 'connection.quickConnect.start',
        payload: { serverUrl: 'http://localhost:8096', allowInsecureRemote: false },
      }),
    ]);
  });

  it('does not overlap slow Quick Connect polls', async () => {
    vi.useFakeTimers();
    const bridge = new SlowQuickConnectBridge(false);
    render(<CatalogApp bridge={bridge} initialConnected={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Quick Connect' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('842916')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6_500);
    });
    expect(bridge.pollCount).toBe(1);
  });

  it('stays connected and reports an error when secure disconnect fails', async () => {
    const bridge = new MockBridge(true, {
      'connection.disconnect': new Error('macOS Keychain could not remove the access token.'),
    });
    render(<CatalogApp bridge={bridge} initialConnected />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect from Jellyfin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('macOS Keychain');
    expect(screen.getByRole('heading', { name: 'Library', level: 1 })).toBeInTheDocument();
  });

  it('clears a stale address error as soon as the address is edited', async () => {
    const bridge = new MockBridge(false);
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected={false} />);

    await user.clear(screen.getByLabelText('Server address'));
    await user.type(screen.getByLabelText('Server address'), 'not a valid address');
    await user.type(screen.getByLabelText('Username'), 'alex');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('alert')).toHaveTextContent('not valid');
    expect(bridge.requests).toHaveLength(0);

    await user.clear(screen.getByLabelText('Server address'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

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

  it('shows one responsive shelf row and expands all loaded items without horizontal paging', async () => {
    let shelfWidth = 1_200;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('media-shelf') ? rect(shelfWidth) : rect(0);
    });
    const user = userEvent.setup();
    render(<CatalogApp bridge={new LongHomeBridge()} initialConnected initialRoute="home" />);

    const heading = await screen.findByRole('heading', { name: 'Continue Watching' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    const shelf = within(section!);
    const toggle = shelf.getByRole('button', { name: 'See all Continue Watching (20)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toBe(
      section!.querySelector('.media-shelf'),
    );
    expect(shelf.getAllByRole('button', { name: /Open Continue Watching/ })).toHaveLength(6);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(shelf.getAllByRole('button', { name: /Open Continue Watching/ })).toHaveLength(20);

    await user.click(shelf.getByRole('button', { name: 'Show less Continue Watching' }));
    const lastVisibleCard = shelf.getByRole('button', { name: 'Open Continue Watching 6' });
    lastVisibleCard.focus();
    shelfWidth = 358;
    window.dispatchEvent(new Event('resize'));

    await waitFor(() =>
      expect(shelf.getAllByRole('button', { name: /Open Continue Watching/ })).toHaveLength(2),
    );
    expect(document.activeElement).toBe(toggle);

    shelfWidth = 4_000;
    window.dispatchEvent(new Event('resize'));
    await waitFor(() =>
      expect(shelf.queryByRole('button', { name: 'See all Continue Watching (20)' })).toBeNull(),
    );
    expect(document.activeElement).toBe(
      shelf.getByRole('button', { name: 'Open Continue Watching 1' }),
    );
  });

  it('preserves shelf keyboard focus when refreshed items disappear', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('media-shelf') ? rect(1_200) : rect(0);
    });
    const bridge = new ChangingHomeBridge();
    const view = render(<HomeScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    const heading = await screen.findByRole('heading', { name: 'Continue Watching' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();
    const shelf = within(section!);
    shelf.getByRole('button', { name: 'Open Continue Watching 6' }).focus();

    bridge.reduceShelves();
    view.rerender(<HomeScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);

    await waitFor(() =>
      expect(shelf.getAllByRole('button', { name: /Open Continue Watching/ })).toHaveLength(2),
    );
    expect(document.activeElement).toBe(
      shelf.getByRole('button', { name: 'Open Continue Watching 1' }),
    );

    bridge.emptyShelves();
    view.rerender(<HomeScreen bridge={bridge} refreshKey={2} onSelect={() => undefined} />);

    expect(await screen.findByText('Your library is quiet')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Library', level: 1 }));
  });

  it('keeps Home content visible while refreshing and retains it after a refresh failure', async () => {
    const bridge = new PausableCatalogBridge();
    const view = render(<HomeScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    expect(await screen.findByRole('heading', { name: 'Continue Watching' })).toBeInTheDocument();
    bridge.pause(['home'], true);
    view.rerender(<HomeScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Continue Watching' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading catalog')).toBeNull();
    expect(await screen.findByText('Updating…')).toBeInTheDocument();

    bridge.release();
    expect(await screen.findByText(/Couldn’t refresh:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Crossing Lines' })).toBeInTheDocument();
  });

  it('keeps a successful empty Home state visible when its refresh fails', async () => {
    const bridge = new PausableCatalogBridge(true, {
      'catalog.query': { Items: [], TotalRecordCount: 0, StartIndex: 0 },
    });
    const view = render(<HomeScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    expect(await screen.findByText('Your library is quiet')).toBeInTheDocument();
    bridge.pause(['home'], true);
    view.rerender(<HomeScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);

    expect(screen.getByText('Your library is quiet')).toBeInTheDocument();
    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    bridge.release();

    expect(await screen.findByText(/Couldn’t refresh:/)).toBeInTheDocument();
    expect(screen.getByText('Your library is quiet')).toBeInTheDocument();
  });

  it('shows each supported Jellyfin library separately and scopes its grid query', async () => {
    const bridge = new MultipleLibrariesBridge();
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="home" />);

    expect(await screen.findByRole('button', { name: 'Anime' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Films' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kids TV' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Music' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Anime' }));
    expect(await screen.findByRole('heading', { name: 'Anime', level: 1 })).toBeInTheDocument();
    expect(
      bridge.requests.some(
        (request) =>
          request.operation === 'catalog.query' &&
          request.payload.kind === 'library' &&
          request.payload.parentId === 'anime' &&
          request.payload.itemType === 'Series',
      ),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Films' }));
    expect(await screen.findByRole('heading', { name: 'Films', level: 1 })).toBeInTheDocument();
    expect(
      bridge.requests.some(
        (request) =>
          request.operation === 'catalog.query' &&
          request.payload.kind === 'library' &&
          request.payload.parentId === 'films' &&
          request.payload.itemType === 'Movie',
      ),
    ).toBe(true);
  });

  it('paginates and sorts a movie library', async () => {
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="library" />);

    expect(await screen.findByText('The Quiet Orbit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Windward')).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();

    document.documentElement.scrollTop = 640;
    await user.click(screen.getByRole('button', { name: 'Open Windward' }));
    expect(document.documentElement.scrollTop).toBe(0);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(document.documentElement.scrollTop).toBe(640);
    expect(screen.getByText('Windward')).toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Sort by'), 'title');
    await waitFor(() => expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument());
    expect(
      bridge.requests.some(
        (request) =>
          request.operation === 'catalog.query' &&
          request.payload.kind === 'library' &&
          request.payload.sortBy === 'SortName',
      ),
    ).toBe(true);
  });

  it('fills complete responsive library rows and anchors the visible range after resizing', async () => {
    let gridWidth = 1_400;
    let gridTop = 220;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1512 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 982 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('catalog-grid-region')
        ? rect(gridWidth, gridTop, 700)
        : rect(0);
    });
    const bridge = new MockBridge();
    const user = userEvent.setup();
    render(<CatalogApp bridge={bridge} initialConnected initialRoute="library" />);

    expect(await screen.findByText(/Showing 1–16 of 24 · Page 1 of 2/)).toBeInTheDocument();
    expect(
      bridge.requests
        .filter(
          (request) => request.operation === 'catalog.query' && request.payload.kind === 'library',
        )
        .at(-1)?.payload,
    ).toMatchObject({ startIndex: 0, limit: 16 });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText(/Showing 17–24 of 24 · Page 2 of 2/)).toBeInTheDocument();

    const requestCountBeforeHide = bridge.requests.filter(
      (request) => request.operation === 'catalog.query' && request.payload.kind === 'library',
    ).length;
    gridWidth = 0;
    window.dispatchEvent(new Event('resize'));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 175));
    });
    expect(
      bridge.requests.filter(
        (request) => request.operation === 'catalog.query' && request.payload.kind === 'library',
      ),
    ).toHaveLength(requestCountBeforeHide);
    expect(screen.getByText(/Showing 17–24 of 24 · Page 2 of 2/)).toBeInTheDocument();

    gridWidth = 1_020;
    gridTop = 220;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    window.dispatchEvent(new Event('resize'));

    await waitFor(() =>
      expect(
        bridge.requests
          .filter(
            (request) =>
              request.operation === 'catalog.query' && request.payload.kind === 'library',
          )
          .at(-1)?.payload,
      ).toMatchObject({ startIndex: 12, limit: 12 }),
    );
    expect(await screen.findByText(/Showing 13–24 of 24 · Page 2 of 2/)).toBeInTheDocument();
  });

  it('keeps a library page visible during a background refresh', async () => {
    const bridge = new PausableCatalogBridge();
    const view = render(
      <GridScreen
        bridge={bridge}
        refreshKey={0}
        library={{ id: 'library-movies', name: 'Movies', kind: 'movie' }}
        onSelect={() => undefined}
      />,
    );

    expect(await screen.findByText('The Quiet Orbit')).toBeInTheDocument();
    bridge.pause(['library']);
    view.rerender(
      <GridScreen
        bridge={bridge}
        refreshKey={1}
        library={{ id: 'library-movies', name: 'Movies', kind: 'movie' }}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText('The Quiet Orbit')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading catalog')).toBeNull();
    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    bridge.release();
    await waitFor(() => expect(screen.queryByText('Updating…')).toBeNull());
  });

  it('clamps back to the final valid page when a library total shrinks', async () => {
    const bridge = new ShrinkingLibraryBridge();
    const user = userEvent.setup();
    const library = { id: 'library-movies', name: 'Movies', kind: 'movie' } as const;
    const view = render(
      <GridScreen bridge={bridge} refreshKey={0} library={library} onSelect={() => undefined} />,
    );

    expect(await screen.findByText('The Quiet Orbit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Windward')).toBeInTheDocument();

    bridge.shrink();
    view.rerender(
      <GridScreen bridge={bridge} refreshKey={1} library={library} onSelect={() => undefined} />,
    );

    expect(await screen.findByText('Remaining 1')).toBeInTheDocument();
    expect(screen.queryByText('Windward')).toBeNull();
    expect(
      bridge.requests
        .filter(
          (request) => request.operation === 'catalog.query' && request.payload.kind === 'library',
        )
        .at(-1)?.payload,
    ).toMatchObject({ startIndex: 0, limit: 12 });
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

  it('preserves a search query and its results after opening details and going back', async () => {
    const user = userEvent.setup();
    render(<CatalogApp bridge={new MockBridge()} initialConnected initialRoute="search" />);

    await user.type(screen.getByRole('searchbox'), 'Horizons');
    await user.click(await screen.findByRole('button', { name: 'Open Horizons' }));
    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(screen.getByRole('searchbox')).toHaveValue('Horizons');
    expect(screen.getByText('Horizons')).toBeInTheDocument();
  });

  it('keeps committed search results visible during a background refresh', async () => {
    const bridge = new PausableCatalogBridge();
    const user = userEvent.setup();
    const view = render(<SearchScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    await user.type(screen.getByRole('searchbox'), 'Horizons');
    expect(await screen.findByText('Horizons')).toBeInTheDocument();

    bridge.pause(['search']);
    view.rerender(<SearchScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);

    expect(screen.getByText('Horizons')).toBeInTheDocument();
    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    bridge.release();

    await waitFor(() => expect(screen.queryByText('Updating…')).toBeNull());
    expect(screen.getByText('Horizons')).toBeInTheDocument();
  });

  it('keeps a committed no-matches state visible when its refresh fails', async () => {
    const bridge = new PausableCatalogBridge();
    const user = userEvent.setup();
    const view = render(<SearchScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    await user.type(screen.getByRole('searchbox'), 'No Such Title');
    expect(await screen.findByText('No matches')).toBeInTheDocument();

    bridge.pause(['search'], true);
    view.rerender(<SearchScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);

    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(await screen.findByText('Updating…')).toBeInTheDocument();
    bridge.release();

    expect(await screen.findByText(/Couldn’t refresh:/)).toBeInTheDocument();
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('ignores a stale search response that resolves after a newer refresh', async () => {
    const bridge = new SequencedSearchBridge();
    const user = userEvent.setup();
    const view = render(<SearchScreen bridge={bridge} refreshKey={0} onSelect={() => undefined} />);

    await user.type(screen.getByRole('searchbox'), 'Horizons');
    expect(await screen.findByText('Horizons')).toBeInTheDocument();

    view.rerender(<SearchScreen bridge={bridge} refreshKey={1} onSelect={() => undefined} />);
    await waitFor(() => expect(bridge.searchRequests).toBe(2));
    view.rerender(<SearchScreen bridge={bridge} refreshKey={2} onSelect={() => undefined} />);
    await waitFor(() => expect(bridge.searchRequests).toBe(3));

    bridge.resolveNewer();
    expect(await screen.findByText('Fresh Result')).toBeInTheDocument();
    bridge.resolveOlder();
    await act(async () => Promise.resolve());

    expect(screen.getByText('Fresh Result')).toBeInTheDocument();
    expect(screen.queryByText('Stale Result')).toBeNull();
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

    act(() =>
      bridge.emitPlaybackState({
        version: 1,
        playbackId: 'demo-playback-1',
        sequence: 1,
        generation: 1,
        status: 'playing',
        itemId: demoShowDetails.id,
        positionTicks: 14_520_000_000,
        durationTicks: 26_400_000_000,
        title: 'Crossing Lines',
        playMethod: 'Transcode',
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
        playbackRate: 1,
        isBuffering: false,
      }),
    );

    const initialStart = bridge.requests.find((request) => request.operation === 'playback.start');
    expect(initialStart?.payload).toMatchObject({
      mediaSourceId: 'source-4k',
      audioStreamIndex: 7,
      subtitleStreamIndex: 8,
      openInNewWindow: false,
      startPositionTicks: 14_520_000_000,
    });
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(1)?.payload,
    ).toMatchObject({ videoTranscodeConfirmationId: 'demo-transcode-confirmation' });

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

  it('keeps details status, actions, and progress synchronized with native playback', async () => {
    const bridge = new MockBridge();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );
    const baseState: PublicPlaybackState = {
      version: 1,
      playbackId: 'play-live-status',
      sequence: 1,
      generation: 1,
      status: 'playing',
      itemId: demoShowDetails.id,
      positionTicks: 6_600_000_000,
      durationTicks: 26_400_000_000,
      title: 'Crossing Lines',
      seriesName: 'HORIZONS',
      seasonNumber: 1,
      episodeNumber: 3,
      playMethod: 'DirectPlay',
      startedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    act(() => bridge.emitPlaybackState(baseState));
    expect(screen.getByText(/Playing in IINA · 11:00 of 44:00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Playing Episode/ })).toBeDisabled();
    expect(screen.getAllByRole('progressbar', { name: '25 percent watched' })).toHaveLength(2);

    act(() =>
      bridge.emitPlaybackState({
        ...baseState,
        sequence: 2,
        status: 'paused',
        positionTicks: 7_200_000_000,
        updatedAtMs: Date.now(),
      }),
    );
    expect(screen.getByText('Paused in IINA · 12:00 of 44:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paused Episode/ })).toBeDisabled();

    act(() =>
      bridge.emitPlaybackState({
        ...baseState,
        sequence: 3,
        status: 'stopped',
        positionTicks: 26_400_000_000,
        stopReason: 'completed',
        updatedAtMs: Date.now(),
      }),
    );
    expect(screen.getByText('Finished playing in IINA.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play Episode' })).toBeEnabled();
    expect(screen.getAllByRole('progressbar', { name: '100 percent watched' })).toHaveLength(2);
  });

  it('uses the live stopped position for resume', async () => {
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
    const state: PublicPlaybackState = {
      version: 1,
      playbackId: 'play-live-resume',
      sequence: 1,
      generation: 1,
      status: 'stopped',
      stopReason: 'user',
      itemId: demoShowDetails.id,
      positionTicks: 7_200_000_000,
      durationTicks: 26_400_000_000,
      title: 'Crossing Lines',
      playMethod: 'DirectPlay',
      startedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    act(() => bridge.emitPlaybackState(state));
    await user.click(screen.getByRole('button', { name: /Resume Episode/ }));
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({ startPositionTicks: 7_200_000_000, openInNewWindow: false });
  });

  it('uses the last exact native position, not UI extrapolation, for a new window', async () => {
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
    const now = Date.now();

    act(() =>
      bridge.emitPlaybackState({
        playbackId: 'play-live-playing',
        version: 1,
        sequence: 1,
        generation: 1,
        status: 'playing',
        itemId: demoShowDetails.id,
        positionTicks: 8_400_000_000,
        durationTicks: 26_400_000_000,
        title: 'Crossing Lines',
        playMethod: 'DirectPlay',
        startedAtMs: now - 10_000,
        updatedAtMs: now - 5_000,
        playbackRate: 2,
        isBuffering: false,
      }),
    );
    expect(screen.getByText(/Playing in IINA · 14:10 of 44:00/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open in New Window' }));
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({ startPositionTicks: 8_400_000_000, openInNewWindow: true });
  });

  it('turns an acknowledged but stuck preparing session into a retryable warning', () => {
    const bridge = new MockBridge();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );
    const now = Date.now();

    act(() =>
      bridge.emitPlaybackState({
        version: 1,
        playbackId: 'play-stuck-preparing',
        sequence: 7,
        generation: 1,
        status: 'preparing',
        itemId: demoShowDetails.id,
        positionTicks: 0,
        durationTicks: 26_400_000_000,
        title: 'Crossing Lines',
        playMethod: 'DirectPlay',
        startedAtMs: now - 60_001,
        updatedAtMs: now,
      }),
    );

    expect(
      screen.getByText('IINA is taking longer than expected to start playback. You can try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry Episode' })).toBeEnabled();
  });

  it('prefers an active same-item window over a newer or requested stopped window', async () => {
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
    await user.click(screen.getByRole('button', { name: /Resume Episode/ }));
    const now = Date.now();
    const common = {
      version: 1 as const,
      generation: 1,
      itemId: demoShowDetails.id,
      durationTicks: 26_400_000_000,
      title: 'Crossing Lines',
      playMethod: 'DirectPlay' as const,
      updatedAtMs: now,
    };
    act(() => {
      bridge.emitPlaybackState({
        ...common,
        playbackId: 'demo-playback-1',
        sequence: 2,
        status: 'stopped',
        stopReason: 'user',
        positionTicks: 7_200_000_000,
        startedAtMs: now + 1_000,
      });
      bridge.emitPlaybackState({
        ...common,
        playbackId: 'still-playing',
        sequence: 1,
        status: 'playing',
        positionTicks: 8_400_000_000,
        startedAtMs: now,
      });
    });

    expect(screen.getByText(/Playing in IINA · 14:00 of 44:00/)).toBeInTheDocument();
    expect(screen.queryByText(/Playback stopped in IINA/)).toBeNull();
  });

  it('turns an unacknowledged native launch into a recoverable error instead of waiting forever', async () => {
    vi.useFakeTimers();
    const bridge = new MockBridge();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );
    const now = Date.now();
    act(() =>
      bridge.emitPlaybackState({
        version: 1,
        playbackId: 'older-same-item',
        sequence: 1,
        generation: 1,
        status: 'paused',
        itemId: demoShowDetails.id,
        positionTicks: 2_000_000_000,
        durationTicks: 26_400_000_000,
        title: 'Crossing Lines',
        playMethod: 'DirectPlay',
        startedAtMs: now - 30_000,
        updatedAtMs: now,
      }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in New Window' }));
      await Promise.resolve();
    });
    expect(screen.getByText('Opening in a new IINA window…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starting Episode' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open in New Window' })).toBeDisabled();

    act(() => vi.advanceTimersByTime(20_000));

    expect(
      screen.getByText(
        'IINA did not report that playback started. Check the player window and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Opening in a new IINA window…')).toBeNull();
  });

  it('does not apply another item’s playback state to the selected details', () => {
    const bridge = new MockBridge();
    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );

    act(() =>
      bridge.emitPlaybackState({
        version: 1,
        playbackId: 'play-other-item',
        sequence: 1,
        generation: 1,
        status: 'playing',
        itemId: 'unrelated-episode',
        positionTicks: 100,
        durationTicks: 1_000,
        title: 'Another Episode',
        playMethod: 'DirectPlay',
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      }),
    );

    expect(screen.queryByText(/Playing in IINA/)).toBeNull();
    expect(screen.getByRole('button', { name: /Resume Episode/ })).toBeEnabled();
  });

  it('reconciles refreshed Jellyfin progress without remounting the details route', async () => {
    const bridge = new MockBridge();
    const view = render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={demoShowDetails}
      />,
    );
    const refreshed = {
      ...demoShowDetails,
      progress: 0.75,
      playbackPositionTicks: 19_800_000_000,
      progressLabel: '11 min remaining',
      episodes: demoShowDetails.episodes.map((episode) =>
        episode.id === demoShowDetails.id
          ? { ...episode, progress: 0.75, playbackPositionTicks: 19_800_000_000 }
          : episode,
      ),
    };

    view.rerender(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={refreshed}
      />,
    );

    expect(await screen.findAllByRole('progressbar', { name: '75 percent watched' })).toHaveLength(
      2,
    );
  });

  it('keeps a multi-row episode grid in document flow after the details content', () => {
    const episodes = Array.from({ length: 10 }, (_, index) => ({
      ...demoShowDetails.episodes[index % demoShowDetails.episodes.length]!,
      id: `episode-${index + 1}`,
      episodeNumber: index + 1,
      title: `Episode ${index + 1}`,
    }));
    const { container } = render(
      <CatalogApp
        bridge={new MockBridge()}
        initialConnected
        initialRoute="details"
        showOverride={{ ...demoShowDetails, episodes }}
      />,
    );

    const detailsContent = container.querySelector<HTMLElement>('.details-content');
    const episodeSection = container.querySelector<HTMLElement>('.episode-section');
    const detailsScreen = container.querySelector<HTMLElement>('.details-screen');

    expect(detailsContent).not.toBeNull();
    expect(episodeSection).not.toBeNull();
    expect(detailsScreen).not.toBeNull();
    expect(detailsContent!.compareDocumentPosition(episodeSection!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(window.getComputedStyle(episodeSection!).position).toBe('relative');
    expect(window.getComputedStyle(detailsScreen!).overflowX).toBe('hidden');
    expect(window.getComputedStyle(detailsScreen!).overflowY).not.toBe('hidden');
    expect(within(episodeSection!).getAllByRole('button')).toHaveLength(10);
  });

  it('does not offer playback for a series with no playable episodes', async () => {
    const bridge = new EmptySeriesBridge();

    render(<CatalogApp bridge={bridge} initialConnected initialRoute="details" />);

    expect(
      await screen.findByText('No playable episodes are available in this series.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume Episode/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Play from Beginning/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open in New Window' })).toBeNull();
    expect(screen.queryByLabelText('Version')).toBeNull();
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start'),
    ).toHaveLength(0);
    expect(bridge.episodeRequests).toBe(25);
  });

  it('does not replace an unavailable direct episode with the first episode in its series', () => {
    const unavailableEpisode = {
      ...demoShowDetails,
      id: 'missing-episode',
      kind: 'episode',
      playable: false,
      episodeTitle: 'Missing episode',
      episodeLabel: 'S1 · E99',
      progress: 0,
      playbackPositionTicks: 0,
      versions: [],
    } satisfies ShowDetails;

    render(
      <CatalogApp
        bridge={new MockBridge()}
        initialConnected
        initialRoute="details"
        showOverride={unavailableEpisode}
      />,
    );

    expect(screen.getAllByText('S1 · E99 · Missing episode')).toHaveLength(2);
    expect(screen.getByText('This item is not available for playback.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Play Episode|Resume Episode/ })).toBeNull();
  });

  it('offers Play rather than Resume for an unstarted episode', async () => {
    const bridge = new MockBridge();
    const unstartedEpisode = {
      ...demoShowDetails,
      id: 'unstarted-episode',
      kind: 'episode',
      episodeTitle: 'Pilot',
      episodeLabel: 'S1 · E1',
      progress: 0,
      playbackPositionTicks: 0,
      episodes: [],
    } satisfies ShowDetails;
    const user = userEvent.setup();

    render(
      <CatalogApp
        bridge={bridge}
        initialConnected
        initialRoute="details"
        showOverride={unstartedEpisode}
      />,
    );

    expect(screen.queryByRole('button', { name: /Resume Episode/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Play from Beginning/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Play Episode' }));
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({ itemId: 'unstarted-episode', startPositionTicks: 0 });
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
      videoTranscodeConfirmationId: 'demo-transcode-confirmation',
      mediaSourceId: 'source-4k',
      startPositionTicks: 14_520_000_000,
    });
    expect(
      await screen.findByText('Opening converted playback in a new IINA window…'),
    ).toBeInTheDocument();
  });

  it('requires another review when a transcode permit expires or the plan changes', async () => {
    const bridge = new MockBridge(true, {
      'playback.start': {
        status: 'confirmation-required',
        confirmationId: 'renewed-transcode-confirmation',
        plan: {
          playMethod: 'Transcode',
          conversion: 'video',
          requiresVideoTranscodeConfirmation: true,
          transcodeReasons: ['VideoCodecNotSupported'],
          mediaSourceId: 'source-4k',
        },
      },
    });
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
    await user.click(screen.getByRole('button', { name: /Resume Episode/ }));
    let modal = await screen.findByRole('dialog', { name: 'Video conversion required' });
    await user.click(within(modal).getByRole('button', { name: 'Convert and Play' }));

    expect(
      await screen.findByText(
        'The playback plan changed or the approval expired. Review it and confirm again.',
      ),
    ).toBeInTheDocument();
    modal = screen.getByRole('dialog', { name: 'Video conversion required' });
    expect(modal).toBeInTheDocument();
    expect(
      bridge.requests.filter((request) => request.operation === 'playback.start').at(-1)?.payload,
    ).toMatchObject({
      videoTranscodeConfirmationId: 'renewed-transcode-confirmation',
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

  it('treats a series as a non-playable container even when it has runtime metadata', () => {
    const details = showDetailsFromResult({
      Id: 'empty-series',
      Name: 'MARRIAGETOXIN',
      Type: 'Series',
      RunTimeTicks: 14_400_000_000,
      UserData: { PlaybackPositionTicks: 2_000_000_000, PlayedPercentage: 20 },
      MediaSources: mediaSources,
    });

    expect(details).toMatchObject({
      kind: 'series',
      seriesId: 'empty-series',
      playbackPositionTicks: 0,
      progress: 0,
      versions: [],
    });
  });

  it.each([
    { Type: 'Episode', LocationType: 'Virtual' },
    { Type: 'Movie', LocationType: 'Offline' },
    { Type: 'Episode', IsPlaceHolder: true },
  ])('marks unavailable direct details as non-playable %#', (availability) => {
    const details = showDetailsFromResult({
      Id: 'unavailable-item',
      Name: 'Unavailable',
      MediaSources: mediaSources,
      ...availability,
    });

    expect(details.playable).toBe(false);
    expect(details.versions).toEqual([]);
    expect(details.playbackPositionTicks).toBe(0);
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

  it('validates, caches, orders, and removes public playback snapshots', () => {
    const handlers = new Map<string, (message: unknown) => void>();
    const bridge = new NativeBridge({
      postMessage: vi.fn(),
      onMessage: (name, handler) => handlers.set(name, handler),
    });
    const listener = vi.fn();
    bridge.subscribePlaybackStates(listener);
    const state: PublicPlaybackState = {
      version: 1,
      playbackId: 'play-native',
      sequence: 2,
      generation: 1,
      status: 'playing',
      itemId: 'episode-native',
      positionTicks: 100,
      durationTicks: 1_000,
      title: 'Native Episode',
      playMethod: 'DirectPlay',
      startedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };

    handlers.get('playback.state')?.(state);
    handlers.get('playback.state')?.({ ...state, sequence: 1, positionTicks: 50 });
    handlers.get('playback.state')?.({ ...state, sequence: 3, accessToken: 'must-not-cross' });

    expect(bridge.getPlaybackStates()).toEqual([state]);
    expect(listener).toHaveBeenCalledOnce();

    handlers.get('playback.state.removed')?.({ playbackId: state.playbackId });
    expect(bridge.getPlaybackStates()).toEqual([state]);

    const removal = {
      version: 1,
      playbackId: state.playbackId,
      generation: state.generation,
      sequence: state.sequence,
      removedAtMs: Date.now(),
    };
    handlers.get('playback.state.removed')?.(removal);
    expect(bridge.getPlaybackStates()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);

    handlers.get('playback.state')?.(state);
    expect(bridge.getPlaybackStates()).toEqual([]);
    handlers.get('playback.state')?.({ ...state, sequence: 3, positionTicks: 200 });
    expect(bridge.getPlaybackStates()).toEqual([{ ...state, sequence: 3, positionTicks: 200 }]);
  });

  it('bounds native playback state and tombstones evicted revisions', () => {
    const handlers = new Map<string, (message: unknown) => void>();
    const bridge = new NativeBridge({
      postMessage: vi.fn(),
      onMessage: (name, handler) => handlers.set(name, handler),
    });
    const base: PublicPlaybackState = {
      version: 1,
      playbackId: 'play-0',
      sequence: 1,
      generation: 1,
      status: 'playing',
      itemId: 'episode-0',
      positionTicks: 100,
      durationTicks: 1_000,
      title: 'Episode',
      playMethod: 'DirectPlay',
      startedAtMs: 1_000,
      updatedAtMs: 1_000,
    };
    for (let index = 0; index < 65; index += 1) {
      handlers.get('playback.state')?.({
        ...base,
        playbackId: `play-${index}`,
        itemId: `episode-${index}`,
        startedAtMs: 1_000 + index,
        updatedAtMs: 1_000 + index,
      });
    }

    expect(bridge.getPlaybackStates()).toHaveLength(64);
    expect(bridge.getPlaybackStates().some(({ playbackId }) => playbackId === 'play-0')).toBe(
      false,
    );

    handlers.get('playback.state')?.(base);
    expect(bridge.getPlaybackStates().some(({ playbackId }) => playbackId === 'play-0')).toBe(
      false,
    );
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
