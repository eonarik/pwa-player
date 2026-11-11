// src/plugins/podcasts/episodeTrack.ts

import type { Episode } from './types';
import type { Track, TrackSource } from '@/types/track';
import { newTrackId, newTrackSourceId } from '@/types/ids';

export interface EpisodeTrackOptions {
  podcastTitle: string;
  fallbackCover: string | null;
  pluginId: string;
}

export function episodeToTrack(
  ep: Pick<Episode, 'title' | 'audioUrl' | 'image' | 'durationSec'>,
  options: EpisodeTrackOptions,
): Track {
  const id = newTrackId();
  const source: TrackSource = {
    id: newTrackSourceId(),
    pluginId: options.pluginId,
    priority: 30,
    kind: 'streaming',
    url: ep.audioUrl,
  };
  return {
    id,
    pluginId: options.pluginId,
    artist: options.podcastTitle,
    title: ep.title,
    albumId: null,
    coverUrl: ep.image || options.fallbackCover,
    sources: [source],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    duration: ep.durationSec ?? undefined,
  };
}

export function episodesToTracks(episodes: Episode[], options: EpisodeTrackOptions): Track[] {
  return episodes.map((ep) => episodeToTrack(ep, options));
}
