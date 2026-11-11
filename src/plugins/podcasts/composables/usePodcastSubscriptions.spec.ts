// src/plugins/podcasts/composables/usePodcastSubscriptions.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Episode, Podcast, Subscription } from '../types';
import { usePodcastSubscriptions } from './usePodcastSubscriptions';

const h = vi.hoisted(() => ({
  fetchFeed: vi.fn(
    async (_feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> => ({
      podcast: {} as Podcast,
      episodes: [] as Episode[],
    }),
  ),
  getSubscriptions: vi.fn(async (): Promise<Subscription[]> => []),
  addSubscription: vi.fn(async (_sub: Subscription): Promise<boolean> => true),
  removeSubscription: vi.fn(async (_feedUrl: string): Promise<boolean> => true),
}));

vi.mock('../PodcastService', () => ({ podcastService: h }));
vi.mock('../PodcastStorage', () => ({
  addSubscription: h.addSubscription,
  getSubscriptions: h.getSubscriptions,
  removeSubscription: h.removeSubscription,
}));

/** In-memory замена PodcastStorage: добавление и удаление реально меняют набор. */
let store: Subscription[] = [];

function podcast(id: string, title = `Подкаст ${id}`): Podcast {
  return {
    id,
    feedUrl: `https://feeds.example.com/${id}.xml`,
    title,
    description: '',
    image: '',
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

function subscription(id: string, episodes: Episode[]): Subscription {
  return { podcast: podcast(id), episodes, updatedAt: 1 };
}

function setup(initialPodcasts: Podcast[] = []) {
  const podcasts = ref<Podcast[]>(initialPodcasts);
  const error = ref('');
  const api = usePodcastSubscriptions({ podcasts, error });
  return { ...api, podcasts, error };
}

function newDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Отдаёт управление циклу событий, чтобы прогнать очередь микротask'ов. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('usePodcastSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = [];
    h.fetchFeed.mockImplementation(async (feedUrl: string) => ({
      podcast: { ...podcast('loaded', 'Загруженный'), feedUrl },
      episodes: [episode('e1')],
    }));
    h.getSubscriptions.mockImplementation(async () => [...store]);
    h.addSubscription.mockImplementation(async (sub: Subscription) => {
      store.push(sub);
      return true;
    });
    h.removeSubscription.mockImplementation(async (feedUrl: string) => {
      const before = store.length;
      store = store.filter((s) => s.podcast.feedUrl !== feedUrl);
      return store.length < before;
    });
  });

  describe('набор подписок', () => {
    it('refreshSubscriptions запоминает feedUrl как признак подписки', async () => {
      store.push(subscription('p1', [episode('e1')]));
      const api = setup();

      await api.refreshSubscriptions();

      expect(api.isSubscribedPodcast(podcast('p1'))).toBe(true);
      expect(api.isSubscribedPodcast(podcast('p2'))).toBe(false);
    });

    it('пустое хранилище — ни одна подписка не отмечена', async () => {
      const api = setup();

      await api.refreshSubscriptions();

      expect(api.isSubscribedPodcast(podcast('p1'))).toBe(false);
    });
  });

  describe('addPodcast', () => {
    it('грузит ленту, сохраняет подписку и обновляет набор', async () => {
      const api = setup([podcast('p1')]);

      await api.addPodcast(podcast('p1'));

      expect(h.fetchFeed).toHaveBeenCalledWith('https://feeds.example.com/p1.xml');
      expect(store).toHaveLength(1);
      expect(store[0]!.episodes.map((e) => e.id)).toEqual(['e1']);
      expect(store[0]!.podcast.title).toBe('Загруженный');
      expect(store[0]!.updatedAt).toBeTypeOf('number');
      expect(api.isSubscribedPodcast(podcast('p1'))).toBe(true);
      expect(api.error.value).toBe('');
    });

    it('помечает список на перерисовку', async () => {
      const api = setup([podcast('p1')]);
      const before = api.podcasts.value;

      await api.addPodcast(podcast('p1'));

      expect(api.podcasts.value).not.toBe(before);
      expect(api.podcasts.value).toEqual(before);
    });

    it('не грузит повторно уже подписанную ленту', async () => {
      store.push(subscription('p1', [episode('e1')]));
      const api = setup();
      await api.refreshSubscriptions();

      await api.addPodcast(podcast('p1'));

      expect(h.fetchFeed).not.toHaveBeenCalled();
      expect(store).toHaveLength(1);
    });

    it('пока одна лента грузится, вторая не стартует', async () => {
      const deferred = newDeferred<{ podcast: Podcast; episodes: Episode[] }>();
      h.fetchFeed.mockImplementation(() => deferred.promise);
      const api = setup();

      const first = api.addPodcast(podcast('p1'));
      expect(api.isLoadingSubscription.value).toBe('p1');

      await api.addPodcast(podcast('p2'));
      expect(h.fetchFeed).toHaveBeenCalledTimes(1);

      deferred.resolve({ podcast: podcast('loaded'), episodes: [episode('e1')] });
      await first;
      expect(api.isLoadingSubscription.value).toBeNull();
    });

    it('сбой ленты даёт текст ошибки и не создаёт подписку', async () => {
      h.fetchFeed.mockImplementation(async () => {
        throw new Error('rss down');
      });
      const api = setup();

      await api.addPodcast(podcast('p1'));

      expect(store).toHaveLength(0);
      expect(api.error.value).toBe('Не удалось загрузить RSS');
      expect(api.isLoadingSubscription.value).toBeNull();
    });
  });

  describe('getOrLoadEpisodes', () => {
    it('берёт эпизоды из подписки без обращения к RSS', async () => {
      store.push(subscription('p1', [episode('e1'), episode('e2')]));
      const api = setup();

      const result = await api.getOrLoadEpisodes(podcast('p1'));

      expect(result?.map((e) => e.id)).toEqual(['e1', 'e2']);
      expect(h.fetchFeed).not.toHaveBeenCalled();
      expect(api.isLoadingSubscription.value).toBeNull();
    });

    it('без подписки грузит RSS и создаёт подписку', async () => {
      const api = setup([podcast('p1')]);

      const result = await api.getOrLoadEpisodes(podcast('p1'));

      expect(result?.map((e) => e.id)).toEqual(['e1']);
      expect(store).toHaveLength(1);
      expect(api.isSubscribedPodcast(podcast('p1'))).toBe(true);
    });

    it('подписку с пустым списком пополняет из RSS, но не пересоздаёт', async () => {
      store.push(subscription('p1', []));
      const api = setup();

      const result = await api.getOrLoadEpisodes(podcast('p1'));

      expect(result?.map((e) => e.id)).toEqual(['e1']);
      expect(store).toHaveLength(1);
      expect(store[0]!.episodes).toHaveLength(0);
    });

    it('сбой RSS возвращает null и пишет ошибку', async () => {
      h.fetchFeed.mockImplementation(async () => {
        throw new Error('rss down');
      });
      const api = setup();

      const result = await api.getOrLoadEpisodes(podcast('p1'));

      expect(result).toBeNull();
      expect(api.error.value).toBe('Не удалось загрузить RSS');
      expect(api.isLoadingSubscription.value).toBeNull();
    });

    it('на время загрузки помечает подкаст загружающимся', async () => {
      const deferred = newDeferred<{ podcast: Podcast; episodes: Episode[] }>();
      h.fetchFeed.mockImplementation(() => deferred.promise);
      const api = setup();

      const pending = api.getOrLoadEpisodes(podcast('p1'));
      // флаг выставляется после await getSubscriptions(), поэтому дожидаемся микротask'ов
      await tick();
      expect(api.isLoadingSubscription.value).toBe('p1');

      deferred.resolve({ podcast: podcast('loaded'), episodes: [episode('e1')] });
      await pending;
      expect(api.isLoadingSubscription.value).toBeNull();
    });
  });

  describe('removePodcast', () => {
    it('удаляет подписку, обновляет набор и помечает список на перерисовку', async () => {
      store.push(subscription('p1', [episode('e1')]));
      const api = setup([podcast('p1')]);
      await api.refreshSubscriptions();
      const before = api.podcasts.value;

      await api.removePodcast(podcast('p1'));

      expect(h.removeSubscription).toHaveBeenCalledWith('https://feeds.example.com/p1.xml');
      expect(store).toHaveLength(0);
      expect(api.isSubscribedPodcast(podcast('p1'))).toBe(false);
      expect(api.podcasts.value).not.toBe(before);
    });
  });
});
