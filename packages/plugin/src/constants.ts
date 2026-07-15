export const PLUGIN_VERSION = '0.1.0';
export const KEYCHAIN_SERVICE = 'jellyfin-access-token';
export const CONNECTION_PREFERENCE_KEY = 'connectionMetadata';
export const DEVICE_ID_PREFERENCE_KEY = 'deviceId';
export const MANAGED_PLAYER_LABEL = 'jellyfin-managed-player';
export const PLUGIN_PLAYBACK_SCHEME = 'iina-jellyfin:';
export const BRIDGE_REQUEST_MESSAGE = 'bridge.request';
export const BRIDGE_RESPONSE_MESSAGE = 'bridge.response';
export const DEFAULT_PROGRESS_INTERVAL_MS = 10_000;
export const DEFAULT_ARTWORK_LIMIT_BYTES = 8 * 1024 * 1024;

export const PLAYER_MESSAGES = {
  catalogOpen: 'jellyfin.catalog.open',
  closed: 'jellyfin.player.closed',
  plan: 'jellyfin.player.plan',
  planRequest: 'jellyfin.player.plan-request',
  playNext: 'jellyfin.player.play-next',
  replace: 'jellyfin.player.replace',
  state: 'jellyfin.player.state',
  stop: 'jellyfin.player.stop',
  upNext: 'jellyfin.player.up-next',
} as const;
