export const PLUGIN_VERSION = '0.1.1';
export const KEYCHAIN_SERVICE = 'jellyfin-access-token';
export const KEYCHAIN_ACCOUNT = 'active-connection-v1';
export const CONNECTION_PREFERENCE_KEY = 'connectionMetadata';
export const DEVICE_ID_PREFERENCE_KEY = 'deviceId';
export const BRIDGE_REQUEST_MESSAGE = 'bridge.request';
export const BRIDGE_RESPONSE_MESSAGE = 'bridge.response';
export const DEFAULT_PROGRESS_INTERVAL_MS = 10_000;
export const DEFAULT_ARTWORK_LIMIT_BYTES = 8 * 1024 * 1024;
export const AUTO_SKIP_CHAPTER_TITLES_PREFERENCE_KEY = 'autoSkipChapterTitles';

export const PLAYER_MESSAGES = {
  catalogOpen: 'jellyfin.catalog.open',
  closed: 'jellyfin.player.closed',
  diagnostic: 'jellyfin.player.diagnostic',
  launch: 'jellyfin.player.launch',
  playNext: 'jellyfin.player.play-next',
  ready: 'jellyfin.player.ready',
  state: 'jellyfin.player.state',
  stop: 'jellyfin.player.stop',
  upNext: 'jellyfin.player.up-next',
} as const;
