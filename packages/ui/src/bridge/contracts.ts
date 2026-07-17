import type {
  BridgeOperation as CoreBridgeOperation,
  BridgeRequest as CoreBridgeRequest,
  CatalogRequest,
  PlaybackRequest,
} from '@iina-jellyfin/core';

export type BridgeOperation = CoreBridgeOperation;
export type BridgeRequest = CoreBridgeRequest;
export type MediaKind = 'movie' | 'series' | 'episode';

export interface CatalogLibrary {
  id: string;
  name: string;
  kind: Extract<MediaKind, 'movie' | 'series'>;
}

export type SupportedLibrary = CatalogLibrary;

export interface MediaCard {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  runtimeMinutes?: number;
  playbackPositionTicks?: number;
  progress?: number;
  unwatchedCount?: number;
  kind: MediaKind;
  artwork?: string;
  imageTag?: string;
  imageType?: 'Primary' | 'Backdrop' | 'Thumb';
}

export interface HomeCatalog {
  continueWatching: MediaCard[];
  nextUp: MediaCard[];
  recentlyAdded: MediaCard[];
}

export interface TrackChoice {
  id: string;
  label: string;
}

export interface MediaVersionChoice extends TrackChoice {
  audioTracks: TrackChoice[];
  subtitleTracks: TrackChoice[];
  defaultAudioTrackId?: string;
  defaultSubtitleTrackId: string;
}

export interface SeasonChoice extends TrackChoice {
  indexNumber?: number;
}

export interface EpisodeDetails extends MediaCard {
  episodeNumber?: number;
  seasonNumber?: number;
  durationLabel: string;
  versions: MediaVersionChoice[];
  selected?: boolean;
}

export interface ShowDetails {
  id: string;
  kind: MediaKind;
  playable: boolean;
  title: string;
  episodeTitle: string;
  episodeLabel: string;
  overview: string;
  year: number;
  runtimeMinutes: number;
  officialRating: string;
  communityRating: number;
  progress: number;
  playbackPositionTicks: number;
  progressLabel: string;
  seasonProgressLabel: string;
  heroArtwork?: string;
  heroImageTag?: string;
  heroItemId?: string;
  seriesId?: string;
  seasons: SeasonChoice[];
  versions: MediaVersionChoice[];
  episodes: EpisodeDetails[];
}

export interface PublicConnection {
  serverUrl: string;
  serverId: string;
  serverName: string;
  userId: string;
  username: string;
  transport: 'http' | 'https';
  lastConnectedAt: string;
}

type RequestFor<K extends BridgeOperation> = Extract<CoreBridgeRequest, { operation: K }>;
export type BridgePayload<K extends BridgeOperation> = RequestFor<K>['payload'];

export interface BridgeResultMap {
  'connection.probe': {
    server: { Id: string; ServerName: string; Version: string };
    normalizedUrl: string;
    transportPolicy: string;
    isLocal: boolean;
  };
  'connection.login.password': { connection: PublicConnection };
  'connection.quickConnect.start': { code: string; serverName: string; expiresInSeconds: number };
  'connection.quickConnect.poll': { authenticated: boolean; connection?: PublicConnection };
  'connection.disconnect': { disconnected: true };
  'catalog.query': unknown;
  'artwork.fetch': { dataUrl: string };
  'playback.start':
    | {
        status: 'started';
        plan: {
          playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
          conversion: 'none' | 'container' | 'audio' | 'video';
          requiresVideoTranscodeConfirmation: boolean;
          transcodeReasons: string[];
          mediaSourceId: string;
          audioStreamIndex?: number;
          subtitleStreamIndex?: number;
        };
      }
    | {
        status: 'confirmation-required';
        confirmationId: string;
        plan: {
          playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
          conversion: 'none' | 'container' | 'audio' | 'video';
          requiresVideoTranscodeConfirmation: boolean;
          transcodeReasons: string[];
          mediaSourceId: string;
          audioStreamIndex?: number;
          subtitleStreamIndex?: number;
        };
      };
  'playback.stop': { stopped: true };
  'catalog.refresh': { connection?: PublicConnection; refreshedAt: string };
}

export interface BridgeError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type BridgeResponse<K extends BridgeOperation = BridgeOperation> =
  | {
      operation: K;
      requestId: string;
      ok: true;
      result: BridgeResultMap[K];
    }
  | {
      operation: K;
      requestId: string;
      ok: false;
      error: BridgeError;
    };

export interface CatalogBridge {
  request<K extends BridgeOperation>(
    operation: K,
    payload: BridgePayload<K>,
  ): Promise<BridgeResultMap[K]>;
  subscribeInvalidation?(listener: () => void): () => void;
}

export type { CatalogRequest, PlaybackRequest };
