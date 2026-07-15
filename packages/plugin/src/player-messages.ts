import type { AuthenticatedApiContext, BaseItem, PlaybackPlan } from '@iina-jellyfin/core';

export interface PlayerDisplayMetadata {
  title: string;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  overview?: string;
  runtimeTicks?: number;
}

export interface PlayerLaunch {
  nonce: string;
  plan: PlaybackPlan;
  context: AuthenticatedApiContext;
  display: PlayerDisplayMetadata;
}

export function displayMetadataFromItem(item: BaseItem): PlayerDisplayMetadata {
  const display: PlayerDisplayMetadata = { title: item.Name };
  if (item.SeriesName != null) display.seriesName = item.SeriesName;
  if (item.ParentIndexNumber != null) display.seasonNumber = item.ParentIndexNumber;
  if (item.IndexNumber != null) display.episodeNumber = item.IndexNumber;
  if (item.Overview != null) display.overview = item.Overview;
  if (item.RunTimeTicks != null) display.runtimeTicks = item.RunTimeTicks;
  return display;
}

export function publicPlaybackResult(plan: PlaybackPlan) {
  return {
    playMethod: plan.playMethod,
    conversion: plan.conversion,
    requiresVideoTranscodeConfirmation: plan.requiresVideoTranscodeConfirmation,
    transcodeReasons: plan.transcodeReasons,
    mediaSourceId: plan.mediaSourceId,
    audioStreamIndex: plan.audioStreamIndex,
    subtitleStreamIndex: plan.subtitleStreamIndex,
  };
}
