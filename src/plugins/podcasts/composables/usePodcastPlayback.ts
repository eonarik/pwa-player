// src/plugins/podcasts/composables/usePodcastPlayback.ts

import { usePlayerStore } from '@/stores/player';
import type { Track } from '@/types/track';
import { PLUGIN_ID } from '../constants';
import { episodesToTracks } from '../episodeTrack';
import type { Episode, Podcast } from '../types';

export interface PodcastPlaybackDeps {
  /** Эпизоды подкаста из подписки или из RSS; null, если загрузка не удалась. */
  ensureEpisodes: (podcast: Podcast) => Promise<Episode[] | null>;
}

/**
 * Привязка воспроизведения к подкасту: какой подкаст сейчас играет и
 * запуск/пауза всех его эпизодов.
 */
export function usePodcastPlayback(deps: PodcastPlaybackDeps) {
  const player = usePlayerStore();

  /** Трек принадлежит подкасту, если это наш стрим и название подкаста совпало с artist. */
  function isPodcastTrack(track: Track, podcast: Podcast): boolean {
    const source = track.sources[0];
    if (!source || source.kind !== 'streaming' || source.pluginId !== PLUGIN_ID) return false;
    return track.artist === podcast.title;
  }

  function isCurrentPodcast(podcast: Podcast): boolean {
    const track = player.currentTrack;
    if (!track) return false;
    return isPodcastTrack(track, podcast);
  }

  function isCurrentPodcastPlaying(podcast: Podcast): boolean {
    return player.isPlaying && isCurrentPodcast(podcast);
  }

  async function togglePlayPodcast(podcast: Podcast): Promise<void> {
    if (isCurrentPodcastPlaying(podcast)) {
      player.toggle();
      return;
    }

    const episodes = await deps.ensureEpisodes(podcast);
    if (!episodes || episodes.length === 0) return;

    player.playAll(
      episodesToTracks(episodes, {
        podcastTitle: podcast.title,
        fallbackCover: podcast.image || null,
        pluginId: PLUGIN_ID,
      }),
    );
  }

  return { isCurrentPodcast, isCurrentPodcastPlaying, togglePlayPodcast };
}
