export interface MediaBrowserAuthorizationOptions {
  client: string;
  device: string;
  deviceId: string;
  version: string;
  accessToken?: string;
}

export const DEFAULT_CLIENT_NAME = 'Jellyfin for IINA';
export const DEFAULT_DEVICE_NAME = 'IINA';

function quoteAuthorizationValue(value: string): string {
  if (/\r|\n/.test(value)) throw new TypeError('Authorization values cannot contain line breaks');
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createMediaBrowserAuthorization(options: MediaBrowserAuthorizationOptions): string {
  const fields: Array<[string, string]> = [
    ['Client', options.client],
    ['Device', options.device],
    ['DeviceId', options.deviceId],
    ['Version', options.version],
  ];
  if (options.accessToken !== undefined && options.accessToken !== '') {
    fields.push(['Token', options.accessToken]);
  }

  return `MediaBrowser ${fields
    .map(([key, value]) => `${key}="${quoteAuthorizationValue(value)}"`)
    .join(', ')}`;
}

export function createAuthorizationHeaders(
  options: MediaBrowserAuthorizationOptions,
): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: createMediaBrowserAuthorization(options),
  };
}
