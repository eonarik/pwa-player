// src/plugins/podcasts/composables/usePodcastSubscriptions.ts

import { ref, type Ref } from 'vue';
import { podcastService } from '../PodcastService';
import { addSubscription, getSubscriptions, removeSubscription } from '../PodcastStorage';
import type { Episode, Podcast } from '../types';
import { logger } from '@/utils/logger';

const RSS_ERROR = 'Не удалось загрузить RSS';

export interface PodcastSubscriptionsDeps {
  /** Список каталога: подписка меняется вне него, поэтому нужен принудительный ре-рендер строк. */
  podcasts: Ref<Podcast[]>;
  /** Общий с каталогом текст ошибки (показывается в CatalogLayout). */
  error: Ref<string>;
}

/**
 * Подписки на подкасты: какие ленты уже добавлены, добавление/удаление
 * и получение эпизодов (из кеша подписки или из RSS).
 */
export function usePodcastSubscriptions(deps: PodcastSubscriptionsDeps) {
  const subscribedUrls = ref<Set<string>>(new Set());

  /** id подписки, для которой сейчас грузим ленту, либо null. */
  const isLoadingSubscription = ref<string | null>(null);

  /** Синхронизирует `subscribedUrls` с хранилищем. */
  async function refreshSubscriptions(): Promise<void> {
    const subs = await getSubscriptions();
    subscribedUrls.value = new Set(subs.map((s) => s.podcast.feedUrl));
  }

  function isSubscribedPodcast(podcast: Podcast): boolean {
    return subscribedUrls.value.has(podcast.feedUrl);
  }

  /**
   * Эпизоды подкаста: сначала из сохранённой подписки, иначе — загрузка RSS.
   * Подписка создаётся только если её ещё нет, чтобы не затирать локальные данные.
   */
  async function getOrLoadEpisodes(podcast: Podcast): Promise<Episode[] | null> {
    const subs = await getSubscriptions();
    const existing = subs.find((s) => s.podcast.feedUrl === podcast.feedUrl);
    if (existing && existing.episodes.length > 0) return existing.episodes;

    isLoadingSubscription.value = podcast.id;
    try {
      const { podcast: loaded, episodes } = await podcastService.fetchFeed(podcast.feedUrl);
      if (!existing) {
        await addSubscription({ podcast: loaded, episodes, updatedAt: Date.now() });
        deps.podcasts.value = [...deps.podcasts.value];
        await refreshSubscriptions();
      }
      return episodes;
    } catch (err) {
      logger.error('[podcasts] feed load failed', err);
      deps.error.value = RSS_ERROR;
      return null;
    } finally {
      isLoadingSubscription.value = null;
    }
  }

  async function addPodcast(podcast: Podcast): Promise<void> {
    if (isLoadingSubscription.value || isSubscribedPodcast(podcast)) return;
    isLoadingSubscription.value = podcast.id;
    try {
      const { podcast: loaded, episodes } = await podcastService.fetchFeed(podcast.feedUrl);
      await addSubscription({ podcast: loaded, episodes, updatedAt: Date.now() });
      await refreshSubscriptions();
      deps.podcasts.value = [...deps.podcasts.value];
    } catch (err) {
      logger.error('[podcasts] add failed', err);
      deps.error.value = RSS_ERROR;
    } finally {
      isLoadingSubscription.value = null;
    }
  }

  async function removePodcast(podcast: Podcast): Promise<void> {
    await removeSubscription(podcast.feedUrl);
    await refreshSubscriptions();
    deps.podcasts.value = [...deps.podcasts.value];
  }

  return {
    subscribedUrls,
    isLoadingSubscription,
    refreshSubscriptions,
    isSubscribedPodcast,
    getOrLoadEpisodes,
    addPodcast,
    removePodcast,
  };
}
