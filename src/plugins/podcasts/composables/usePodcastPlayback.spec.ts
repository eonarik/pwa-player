// src/plugins/podcasts/composables/usePodcastPlayback.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Episode, Podcast } from '../types';
import type { Track, TrackSource } from '@/types/track';
import { asFolderId, asTrackId, asTrackSourceId } from '@/types/ids';
import { PLUGIN_ID } from '../constants';
import { usePodcastPlayback } from './usePodcastPlayback';

const h = vi.hoisted(() => ({
  player: {
    isPlaying: false,
    currentTrack: null as Track | null,
    toggle: vi.fn(),
    playAll: vi.fn(),
  },
  ensureEpisodes: vi.fn(async (_podcast: Podcast): Promise<Episode[] | null> => []),
}));

vi.mock('@/stores/player', () => ({ usePlayerStore: () => h.player }));

function podcast(title = 'Мой подкаст', image = ''): Podcast {
  return {
    id: 'p1',
    feedUrl: 'https://feeds.example.com/p1.xml',
    title,
    description: '',
    image,
    author: '',
    categories: [],
    fetchedAt: 0,
  };
}

function episode(id: string, over: Partial<Episode> = {}): Episode {
  return {
    id,
    podcastId: 'p1',
    title: `Эпизод ${id}`,
    description: '',
    audioUrl: `https://cdn.example.com/${id}.mp3`,
    sizeBytes: null,
    durationSec: null,
    publishedAt: 0,
    image: '',
    ...over,
  };
}

/** Трек так, будто его играет плагин подкастов. */
function podcastTrack(
  artist: string,
  options: { title?: string; pluginId?: string; sources?: TrackSource[] } = {},
): Track {
  const pluginId = options.pluginId ?? PLUGIN_ID;
  const title = options.title ?? 'Эпизод 1';
  return {
    id: asTrackId(`t-${artist}-${title}`),
    pluginId,
    artist,
    title,
    albumId: null,
    coverUrl: null,
    sources:
      options.sources ?? [
        { id: asTrackSourceId(`s-${artist}-${title}`), pluginId, priority: 30, kind: 'streaming', url: 'https://cdn/e1.mp3' },
      ],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

/** Локальный источник нужен только чтобы проверить «не наш kind». */
function localSource(): TrackSource {
  return {
    id: asTrackSourceId('s-local'),
    pluginId: PLUGIN_ID,
    priority: 10,
    kind: 'local',
    handle: {} as FileSystemFileHandle,
    folderId: asFolderId('00000000-0000-4000-8000-000000000000'),
  };
}

function setup() {
  return usePodcastPlayback({ ensureEpisodes: h.ensureEpisodes });
}

describe('usePodcastPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.player.isPlaying = false;
    h.player.currentTrack = null;
    h.ensureEpisodes.mockImplementation(async () => []);
  });

  describe('isCurrentPodcast', () => {
    it('без трека в плеере — false', () => {
      const api = setup();
      expect(api.isCurrentPodcast(podcast())).toBe(false);
    });

    it('по совпадению artist с названием подкаста — true', () => {
      h.player.currentTrack = podcastTrack('Мой подкаст');
      const api = setup();
      expect(api.isCurrentPodcast(podcast('Мой подкаст'))).toBe(true);
    });

    it('другой исполнитель — false', () => {
      h.player.currentTrack = podcastTrack('Чужой подкаст');
      const api = setup();
      expect(api.isCurrentPodcast(podcast('Мой подкаст'))).toBe(false);
    });

    it('стрим другого плагина не считается', () => {
      h.player.currentTrack = podcastTrack('Мой подкаст', { pluginId: 'radio' });
      const api = setup();
      expect(api.isCurrentPodcast(podcast())).toBe(false);
    });

    it('локальный трек с тем же artist не считается', () => {
      h.player.currentTrack = podcastTrack('Мой подкаст', { sources: [localSource()] });
      const api = setup();
      expect(api.isCurrentPodcast(podcast())).toBe(false);
    });

    it('трек без источников не считается', () => {
      h.player.currentTrack = podcastTrack('Мой подкаст', { sources: [] });
      const api = setup();
      expect(api.isCurrentPodcast(podcast())).toBe(false);
    });
  });

  describe('isCurrentPodcastPlaying', () => {
    it('на паузе — false', () => {
      h.player.isPlaying = false;
      h.player.currentTrack = podcastTrack('Мой подкаст');
      const api = setup();
      expect(api.isCurrentPodcastPlaying(podcast())).toBe(false);
    });

    it('в воспроизведении текущего подкаста — true', () => {
      h.player.isPlaying = true;
      h.player.currentTrack = podcastTrack('Мой подкаст');
      const api = setup();
      expect(api.isCurrentPodcastPlaying(podcast())).toBe(true);
    });

    it('чужой подкаст на паузе — false', () => {
      h.player.isPlaying = true;
      h.player.currentTrack = podcastTrack('Чужой подкаст');
      const api = setup();
      expect(api.isCurrentPodcastPlaying(podcast())).toBe(false);
    });
  });

  describe('togglePlayPodcast', () => {
    it('останавливает текущий подкаст и не трогает ленту', async () => {
      h.player.isPlaying = true;
      h.player.currentTrack = podcastTrack('Мой подкаст');
      const api = setup();

      await api.togglePlayPodcast(podcast());

      expect(h.player.toggle).toHaveBeenCalledTimes(1);
      expect(h.ensureEpisodes).not.toHaveBeenCalled();
      expect(h.player.playAll).not.toHaveBeenCalled();
    });

    it('не запускает ничего, если эпизоды не загрузились', async () => {
      h.ensureEpisodes.mockImplementation(async () => null);
      const api = setup();

      await api.togglePlayPodcast(podcast());

      expect(h.player.playAll).not.toHaveBeenCalled();
    });

    it('не запускает пустой список эпизодов', async () => {
      h.ensureEpisodes.mockImplementation(async () => []);
      const api = setup();

      await api.togglePlayPodcast(podcast());

      expect(h.player.playAll).not.toHaveBeenCalled();
    });

    it('ставит в очередь все эпизоды подкаста', async () => {
      h.ensureEpisodes.mockImplementation(async () => [episode('e1'), episode('e2')]);
      const api = setup();

      await api.togglePlayPodcast(podcast('Мой подкаст'));

      expect(h.player.playAll).toHaveBeenCalledTimes(1);
      const tracks = h.player.playAll.mock.calls[0]![0] as Track[];
      expect(tracks.map((t) => t.title)).toEqual(['Эпизод e1', 'Эпизод e2']);
      expect(tracks.every((t) => t.artist === 'Мой подкаст')).toBe(true);
      expect(tracks.every((t) => t.pluginId === PLUGIN_ID)).toBe(true);
      expect(tracks[0]!.sources[0]).toMatchObject({ kind: 'streaming', url: 'https://cdn.example.com/e1.mp3' });
    });

    it('обложка эпизода важнее обложки подкаста', async () => {
      h.ensureEpisodes.mockImplementation(async () => [
        episode('e1', { image: 'https://cdn/e1.jpg' }),
        episode('e2', { image: '' }),
      ]);
      const api = setup();

      await api.togglePlayPodcast(podcast('Мой подкаст', 'https://cdn/feed.jpg'));

      const tracks = h.player.playAll.mock.calls[0]![0] as Track[];
      expect(tracks[0]!.coverUrl).toBe('https://cdn/e1.jpg');
      expect(tracks[1]!.coverUrl).toBe('https://cdn/feed.jpg');
    });

    it('длительность из RSS попадает в трек, null превращается в undefined', async () => {
      h.ensureEpisodes.mockImplementation(async () => [
        episode('e1', { durationSec: 125 }),
        episode('e2', { durationSec: null }),
      ]);
      const api = setup();

      await api.togglePlayPodcast(podcast());

      const tracks = h.player.playAll.mock.calls[0]![0] as Track[];
      expect(tracks[0]!.duration).toBe(125);
      expect(tracks[1]!.duration).toBeUndefined();
    });

    it('загрузка уже идущей ленты не блокирует старт другого подкаста', async () => {
      // воспроизведение не связано с isLoadingSubscription — проверка, что эпизоды запрашиваются
      h.ensureEpisodes.mockImplementation(async () => [episode('e1')]);
      const api = setup();

      await api.togglePlayPodcast(podcast());

      expect(h.ensureEpisodes).toHaveBeenCalledTimes(1);
      expect(h.player.playAll).toHaveBeenCalledTimes(1);
    });
  });
});
