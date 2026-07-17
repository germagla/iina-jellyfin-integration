import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { build } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';

const BRIDGE_REQUEST_MESSAGE = 'bridge.request';
const BRIDGE_RESPONSE_MESSAGE = 'bridge.response';
const PLAYER_LAUNCH_MESSAGE = 'jellyfin.player.launch';
const PLAYER_STOP_MESSAGE = 'jellyfin.player.stop';

let globalBundle;

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['packages/plugin/src/global.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['safari14.1'],
    write: false,
  });
  globalBundle = result.outputFiles[0]?.text;
  expect(globalBundle).toBeDefined();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function httpResponse(data, statusCode = 200) {
  return {
    text: data === undefined ? '' : JSON.stringify(data),
    data: data ?? null,
    statusCode,
    reason: statusCode >= 200 && statusCode < 300 ? 'OK' : 'Error',
  };
}

function detailsFixture(itemId) {
  return {
    Id: itemId,
    Name: `Episode ${itemId}`,
    Type: 'Episode',
    LocationType: 'FileSystem',
    RunTimeTicks: 14_400_000_000,
    SeriesName: 'VM Test Series',
    ParentIndexNumber: 1,
    IndexNumber: 1,
  };
}

function directPlayFixture(itemId) {
  return {
    PlaySessionId: `session-${itemId}`,
    MediaSources: [
      {
        Id: `source-${itemId}`,
        Protocol: 'File',
        Container: 'mkv',
        RunTimeTicks: 14_400_000_000,
        SupportsDirectPlay: true,
        SupportsDirectStream: true,
        SupportsTranscoding: true,
        DefaultAudioStreamIndex: 1,
        DefaultSubtitleStreamIndex: -1,
        MediaStreams: [
          { Index: 0, Type: 'Video', Codec: 'h264', IsDefault: true },
          { Index: 1, Type: 'Audio', Codec: 'aac', Language: 'eng', IsDefault: true },
        ],
      },
    ],
  };
}

function playbackRequest(requestId, itemId, overrides = {}) {
  return {
    operation: 'playback.start',
    requestId,
    payload: {
      itemId,
      startPositionTicks: 0,
      maxStreamingBitrate: 120_000_000,
      openInNewWindow: false,
      ...overrides,
    },
  };
}

function createHarness({ createPlayerError } = {}) {
  const metadata = {
    schemaVersion: 1,
    serverUrl: 'https://jellyfin.test/base',
    serverId: 'server-vm-test',
    serverName: 'VM Jellyfin',
    userId: 'user-vm-test',
    username: 'vm-user',
    deviceId: 'iina-vm-test-device',
    acceptedInsecureRemote: false,
    lastConnectedAt: '2026-07-17T00:00:00.000Z',
  };
  const accessToken = 'keychain-only-vm-token';
  const credentialEnvelope = JSON.stringify({
    version: 1,
    serverUrl: metadata.serverUrl,
    serverId: metadata.serverId,
    userId: metadata.userId,
    accessToken,
  });
  const preferences = new Map([
    ['connectionMetadata', JSON.stringify(metadata)],
    ['deviceId', metadata.deviceId],
    ['artworkCacheMaxBytes', 50 * 1024 * 1024],
  ]);
  const standaloneHandlers = new Map();
  const standaloneMessages = [];
  const nativeCalls = [];
  const requests = [];
  const timers = [];
  const files = new Map();
  const deferredDetails = new Map();
  let nextTimerId = 1;
  let nextPlayerId = 41;
  let currentTimerDelay;

  const fileApi = {
    exists(filePath) {
      return files.has(filePath);
    },
    read(filePath) {
      const value = files.get(filePath);
      return typeof value === 'string' ? value : undefined;
    },
    write(filePath, value) {
      files.set(filePath, value);
    },
    delete(filePath) {
      files.delete(filePath);
    },
    list() {
      return [];
    },
    showInFinder() {},
    handle(filePath) {
      return {
        seekToEnd() {},
        offset() {
          const value = files.get(filePath);
          return typeof value === 'string' ? value.length : 0;
        },
        write(value) {
          files.set(filePath, `${files.get(filePath) ?? ''}${value}`);
        },
        readToEnd() {
          const value = files.get(filePath);
          return value instanceof Uint8Array ? value : undefined;
        },
        close() {},
      };
    },
  };

  function itemIdFromUrl(url) {
    const match = /\/Items\/([^/?]+)(?:\/PlaybackInfo)?(?:\?|$)/.exec(url);
    if (match === null) throw new Error(`Unexpected Jellyfin request URL: ${url}`);
    return decodeURIComponent(match[1]);
  }

  const http = {
    async get(url, options) {
      requests.push({ method: 'GET', url, options });
      const itemId = itemIdFromUrl(url);
      const gate = deferredDetails.get(itemId);
      if (gate !== undefined) await gate.promise;
      return httpResponse(detailsFixture(itemId));
    },
    async post(url, options) {
      requests.push({ method: 'POST', url, options });
      if (!url.includes('/PlaybackInfo')) {
        throw new Error(`Unexpected Jellyfin POST URL: ${url}`);
      }
      return httpResponse(directPlayFixture(itemIdFromUrl(url)));
    },
    async download() {
      throw new Error('Artwork download was not expected in a playback orchestration test.');
    },
  };

  const iina = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    file: fileApi,
    http,
    preferences: {
      get(key) {
        return preferences.get(key);
      },
      set(key, value) {
        preferences.set(key, value);
      },
      sync() {},
    },
    utils: {
      keychainRead(service, account) {
        if (service === 'jellyfin-access-token' && account === 'active-connection-v1') {
          return credentialEnvelope;
        }
        return false;
      },
      keychainWrite() {
        return true;
      },
    },
    standaloneWindow: {
      loadFile() {},
      setProperty() {},
      setFrame() {},
      onMessage(name, callback) {
        standaloneHandlers.set(name, callback);
      },
      postMessage(name, payload) {
        standaloneMessages.push({ name, payload });
      },
      open() {},
    },
    menu: {
      item(title, action, options) {
        return { title, action, options };
      },
      addItem() {},
    },
    global: {
      createPlayerInstance(options) {
        nativeCalls.push({
          kind: 'create',
          options,
          timerDelay: currentTimerDelay,
        });
        if (createPlayerError !== undefined) throw createPlayerError;
        return nextPlayerId++;
      },
      postMessage(playerId, name, payload) {
        nativeCalls.push({
          kind: 'post',
          playerId,
          name,
          payload,
          timerDelay: currentTimerDelay,
        });
      },
    },
  };

  function schedule(callback, delay = 0) {
    const timer = { id: nextTimerId++, callback, delay };
    timers.push(timer);
    return timer.id;
  }

  const sandbox = {
    iina,
    setTimeout: schedule,
    setInterval: schedule,
    clearTimeout() {},
    clearInterval() {},
  };
  runInNewContext(globalBundle, sandbox, { filename: 'global.vm.bundle.js' });

  async function flushMicrotasks() {
    for (let count = 0; count < 12; count += 1) await Promise.resolve();
  }

  async function runNextMainTimer() {
    await flushMicrotasks();
    const index = timers.findIndex((timer) => timer.delay === 0);
    if (index < 0) return false;
    const [timer] = timers.splice(index, 1);
    currentTimerDelay = timer.delay;
    try {
      timer.callback();
    } finally {
      currentTimerDelay = undefined;
    }
    await flushMicrotasks();
    return true;
  }

  async function drainMainTimers() {
    for (let count = 0; count < 20; count += 1) {
      if (!(await runNextMainTimer())) return;
    }
    throw new Error('The mocked IINA main-loop timer queue did not drain.');
  }

  function bridgeResponse(requestId) {
    return standaloneMessages.find(
      ({ name, payload }) => name === BRIDGE_RESPONSE_MESSAGE && payload.requestId === requestId,
    )?.payload;
  }

  async function settleBridgeRequest(requestId) {
    for (let count = 0; count < 20; count += 1) {
      await flushMicrotasks();
      await drainMainTimers();
      const response = bridgeResponse(requestId);
      if (response !== undefined) return response;
    }
    throw new Error(`Bridge request ${requestId} did not settle.`);
  }

  function send(payload) {
    const handler = standaloneHandlers.get(BRIDGE_REQUEST_MESSAGE);
    if (handler === undefined) throw new Error('Global did not register the bridge handler.');
    handler(payload);
  }

  async function request(payload) {
    send(payload);
    return settleBridgeRequest(payload.requestId);
  }

  return {
    accessToken,
    bridgeResponse,
    deferDetails(itemId) {
      const gate = deferred();
      deferredDetails.set(itemId, gate);
      return gate;
    },
    drainMainTimers,
    files,
    flushMicrotasks,
    nativeCalls,
    preferences,
    request,
    requests,
    runNextMainTimer,
    send,
    settleBridgeRequest,
  };
}

function expectAllNativeCallsOnIinaMainLoop(harness) {
  expect(harness.nativeCalls.length).toBeGreaterThan(0);
  expect(harness.nativeCalls.every((call) => call.timerDelay === 0)).toBe(true);
}

describe('bundled Global playback orchestration', () => {
  it('creates and targets the initial managed player only in zero-delay IINA callbacks', async () => {
    const harness = createHarness();
    const request = playbackRequest('initial-managed', 'episode-initial');

    harness.send(request);
    await harness.flushMicrotasks();

    expect(harness.nativeCalls).toHaveLength(0);
    expect(await harness.runNextMainTimer()).toBe(true);
    expect(harness.nativeCalls).toMatchObject([
      { kind: 'create', timerDelay: 0, options: { enablePlugins: false } },
    ]);

    await harness.flushMicrotasks();
    expect(harness.nativeCalls.filter(({ kind }) => kind === 'post')).toHaveLength(0);
    expect(await harness.runNextMainTimer()).toBe(true);

    const response = await harness.settleBridgeRequest(request.requestId);
    expect(response).toMatchObject({ ok: true, result: { status: 'started' } });
    expect(harness.nativeCalls[1]).toMatchObject({
      kind: 'post',
      playerId: 41,
      name: PLAYER_LAUNCH_MESSAGE,
      timerDelay: 0,
      payload: {
        plan: {
          itemId: 'episode-initial',
          playMethod: 'DirectPlay',
          url: expect.stringContaining('/Videos/episode-initial/stream?'),
        },
      },
    });
    expectAllNativeCallsOnIinaMainLoop(harness);

    expect([...harness.preferences.values()]).not.toContain(harness.accessToken);
    expect(harness.requests).toHaveLength(2);
  });

  it('delivers active and stopped/idle managed replacements to the same player ID', async () => {
    const harness = createHarness();

    await harness.request(playbackRequest('managed-first', 'episode-first'));
    await harness.request(playbackRequest('managed-active-reuse', 'episode-active'));
    await harness.request({
      operation: 'playback.stop',
      requestId: 'managed-stop',
      payload: { reason: 'user' },
    });
    await harness.request(playbackRequest('managed-idle-reuse', 'episode-idle'));

    expect(harness.nativeCalls.filter(({ kind }) => kind === 'create')).toHaveLength(1);
    const targeted = harness.nativeCalls.filter(({ kind }) => kind === 'post');
    expect(targeted.map(({ playerId }) => playerId)).toEqual([41, 41, 41, 41]);
    expect(targeted.map(({ name }) => name)).toEqual([
      PLAYER_LAUNCH_MESSAGE,
      PLAYER_LAUNCH_MESSAGE,
      PLAYER_STOP_MESSAGE,
      PLAYER_LAUNCH_MESSAGE,
    ]);
    expect(targeted[1].payload.plan.itemId).toBe('episode-active');
    expect(targeted[3].payload.plan.itemId).toBe('episode-idle');
    expectAllNativeCallsOnIinaMainLoop(harness);
  });

  it('opens a separate core without allowing it to steal managed ownership', async () => {
    const harness = createHarness();

    await harness.request(playbackRequest('managed-owner', 'episode-managed'));
    await harness.request(
      playbackRequest('new-window', 'episode-new-window', { openInNewWindow: true }),
    );
    await harness.request(playbackRequest('managed-after-new-window', 'episode-managed-next'));

    expect(harness.nativeCalls.filter(({ kind }) => kind === 'create')).toHaveLength(2);
    const launches = harness.nativeCalls.filter(
      ({ kind, name }) => kind === 'post' && name === PLAYER_LAUNCH_MESSAGE,
    );
    expect(launches.map(({ playerId }) => playerId)).toEqual([41, 42, 41]);
    expect(launches.map(({ payload }) => payload.plan.itemId)).toEqual([
      'episode-managed',
      'episode-new-window',
      'episode-managed-next',
    ]);
    expectAllNativeCallsOnIinaMainLoop(harness);
  });

  it('does not let a superseded created core steal managed ownership before delivery', async () => {
    const harness = createHarness();
    const superseded = playbackRequest('created-but-superseded', 'episode-old-core');
    harness.send(superseded);
    await harness.flushMicrotasks();

    // Create core 41, but pause before the separately scheduled targeted
    // postMessage can deliver the launch or claim managed ownership.
    expect(await harness.runNextMainTimer()).toBe(true);
    expect(harness.nativeCalls).toMatchObject([{ kind: 'create', timerDelay: 0 }]);

    harness.send(playbackRequest('new-managed-owner', 'episode-new-owner'));
    const current = await harness.settleBridgeRequest('new-managed-owner');
    const stale = await harness.settleBridgeRequest(superseded.requestId);
    expect(current).toMatchObject({ ok: true, result: { status: 'started' } });
    expect(stale).toMatchObject({ ok: false, error: { code: 'STALE_PLAYBACK_REQUEST' } });

    await harness.request(playbackRequest('reuse-new-owner', 'episode-owner-reused'));
    expect(harness.nativeCalls.filter(({ kind }) => kind === 'create')).toHaveLength(2);
    const launches = harness.nativeCalls.filter(
      ({ kind, name }) => kind === 'post' && name === PLAYER_LAUNCH_MESSAGE,
    );
    expect(launches.map(({ playerId }) => playerId)).toEqual([42, 42]);
    expect(launches.map(({ payload }) => payload.plan.itemId)).toEqual([
      'episode-new-owner',
      'episode-owner-reused',
    ]);
    expectAllNativeCallsOnIinaMainLoop(harness);
  });

  it('rejects superseded managed work and work from a stale connection generation', async () => {
    const harness = createHarness();
    const supersededGate = harness.deferDetails('episode-superseded');
    harness.send(playbackRequest('superseded', 'episode-superseded'));
    await harness.flushMicrotasks();

    const current = await harness.request(playbackRequest('current', 'episode-current'));
    expect(current).toMatchObject({ ok: true, result: { status: 'started' } });
    supersededGate.resolve();
    const superseded = await harness.settleBridgeRequest('superseded');
    expect(superseded).toMatchObject({
      ok: false,
      error: { code: 'STALE_PLAYBACK_REQUEST' },
    });
    expect(
      harness.nativeCalls.some(
        ({ kind, name, payload }) =>
          kind === 'post' &&
          name === PLAYER_LAUNCH_MESSAGE &&
          payload.plan.itemId === 'episode-superseded',
      ),
    ).toBe(false);

    const generationHarness = createHarness();
    const generationGate = generationHarness.deferDetails('episode-old-connection');
    generationHarness.send(playbackRequest('old-connection', 'episode-old-connection'));
    await generationHarness.flushMicrotasks();
    await generationHarness.request({
      operation: 'connection.disconnect',
      requestId: 'disconnect',
      payload: {},
    });
    generationGate.resolve();
    const staleGeneration = await generationHarness.settleBridgeRequest('old-connection');
    expect(staleGeneration).toMatchObject({
      ok: false,
      error: { code: 'STALE_CONNECTION' },
    });
    expect(generationHarness.nativeCalls).toHaveLength(0);
    expectAllNativeCallsOnIinaMainLoop(harness);
  });

  it('returns a bridge failure when main-loop player creation throws', async () => {
    const harness = createHarness({ createPlayerError: new Error('native creation failed') });
    const response = await harness.request(playbackRequest('create-failure', 'episode-failure'));

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'REQUEST_FAILED',
        message: 'The request could not be completed.',
        recoverable: true,
      },
    });
    expect(harness.nativeCalls).toMatchObject([{ kind: 'create', timerDelay: 0 }]);
    expect(harness.nativeCalls.some(({ kind }) => kind === 'post')).toBe(false);
    expectAllNativeCallsOnIinaMainLoop(harness);
  });
});
