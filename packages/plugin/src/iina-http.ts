import type { HttpRequest } from '@iina-jellyfin/core';
import { redactString } from '@iina-jellyfin/core';

export interface IinaHttpResponse<T = unknown> {
  text: string;
  data: T | null;
  statusCode: number;
  reason: string;
}

export type IinaHttpApi = Pick<IINA.API.HTTP, 'get' | 'post' | 'download'>;

export interface IinaHttpOptions<TBody> {
  params: Record<string, string>;
  headers: Record<string, string>;
  data: TBody;
}

export class JellyfinHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly recoverable: boolean,
    message: string,
  ) {
    super(message);
    this.name = 'JellyfinHttpError';
  }
}

function responseBody<T>(response: IinaHttpResponse<T>): T {
  if (response.data !== null) return response.data;
  if (response.text.trim() === '') return undefined as T;
  try {
    return JSON.parse(response.text) as T;
  } catch {
    throw new JellyfinHttpError(
      response.statusCode,
      true,
      'The Jellyfin server returned an unreadable response.',
    );
  }
}

function safeStatusMessage(response: IinaHttpResponse): string {
  if (response.statusCode === 401 || response.statusCode === 403) {
    return 'The Jellyfin session has expired. Please reconnect.';
  }
  if (response.statusCode === 404) return 'The requested Jellyfin item is no longer available.';
  if (response.statusCode === 429) return 'Jellyfin is busy. Please try again shortly.';
  if (response.statusCode >= 500) return 'Jellyfin is temporarily unavailable.';
  return `Jellyfin request failed (${response.statusCode}).`;
}

export class IinaHttpTransport {
  constructor(private readonly api: IinaHttpApi) {}

  async execute<TResult>(request: HttpRequest<unknown>): Promise<TResult> {
    const data =
      request.body !== null && typeof request.body === 'object'
        ? (request.body as Record<string, unknown>)
        : {};
    const options: IinaHttpOptions<Record<string, unknown>> = {
      params: {},
      headers: request.headers,
      data,
    };
    let response: IinaHttpResponse<TResult>;
    try {
      response =
        request.method === 'GET'
          ? await this.api.get<Record<string, unknown>, TResult>(request.url, options)
          : await this.api.post<Record<string, unknown>, TResult>(request.url, options);
    } catch {
      throw new JellyfinHttpError(0, true, 'Could not reach the Jellyfin server.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new JellyfinHttpError(
        response.statusCode,
        response.statusCode === 0 ||
          response.statusCode === 408 ||
          response.statusCode === 429 ||
          response.statusCode >= 500,
        safeStatusMessage(response),
      );
    }
    return responseBody(response);
  }

  async download(request: HttpRequest, destination: string): Promise<void> {
    try {
      await this.api.download(request.url, destination, {
        method: request.method,
        params: {},
        headers: request.headers,
        data:
          request.body !== null && typeof request.body === 'object'
            ? (request.body as Record<string, unknown>)
            : {},
      });
    } catch {
      throw new JellyfinHttpError(
        0,
        true,
        `Could not download media from ${redactString(new URL(request.url).origin)}.`,
      );
    }
  }
}
