<!-- src/plugins/podcasts/PodcastCatalog.vue -->

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import CatalogLayout from '@/components/catalog/CatalogLayout.vue';
import PodcastFilters from './components/PodcastFilters.vue';
import PodcastCatalogRow from './components/PodcastCatalogRow.vue';
import { usePodcastCatalog } from './composables/usePodcastCatalog';
import { usePodcastSubscriptions } from './composables/usePodcastSubscriptions';
import { usePodcastPlayback } from './composables/usePodcastPlayback';
import type { Podcast } from './types';

const router = useRouter();

const {
  country,
  genre,
  searchQuery,
  topLimit,
  currentPage,
  hasMore,
  isLoading,
  isStale,
  error,
  podcasts,
  isSearchMode,
  listTitle,
  load,
  clearSearch,
  retryLoad,
} = usePodcastCatalog();

const {
  isLoadingSubscription,
  refreshSubscriptions,
  isSubscribedPodcast,
  getOrLoadEpisodes,
  addPodcast,
  removePodcast,
} = usePodcastSubscriptions({ podcasts, error });

const { isCurrentPodcast, isCurrentPodcastPlaying, togglePlayPodcast } = usePodcastPlayback({
  ensureEpisodes: getOrLoadEpisodes,
});

function openPodcast(podcast: Podcast): void {
  if (!isSubscribedPodcast(podcast)) void addPodcast(podcast);
  router.push({ name: 'podcast-detail', params: { feedUrl: encodeURIComponent(podcast.feedUrl) } });
}

onMounted(async () => {
  await refreshSubscriptions();
  void load();
});
</script>

<template>
  <CatalogLayout
    title="Каталог подкастов"
    back-label="К моим подкастам"
    :list-title="listTitle"
    :search-query="searchQuery"
    :show-clear="isSearchMode"
    :is-loading="isLoading"
    :is-stale="isStale"
    :error="error"
    :is-empty="podcasts.length === 0 && !isLoading && !error"
    :current-limit="topLimit"
    :current-page="currentPage"
    :has-more="hasMore"
    :show-pagination="podcasts.length > 0"
    @update:search-query="(v) => (searchQuery = v)"
    @clear="clearSearch"
    @back="router.push({ name: 'podcasts' })"
    @update:current-limit="(v) => (topLimit = v)"
    @prev="currentPage--"
    @next="currentPage++"
  >
    <template #filters>
      <PodcastFilters v-model:country="country" v-model:genre="genre" />
    </template>

    <template #error-action>
      <button
        type="button"
        class="rounded-btn bg-card-bg px-4 py-2 text-xs text-fg transition hover:bg-hover-bg"
        data-testid="podcast-catalog-retry"
        @click="retryLoad"
      >
        Попробовать еще раз
      </button>
    </template>

    <template #list>
      <PodcastCatalogRow
        v-for="pod in podcasts"
        :key="pod.id"
        :podcast="pod"
        :is-current="isCurrentPodcast(pod)"
        :is-playing="isCurrentPodcastPlaying(pod)"
        :is-subscribed="isSubscribedPodcast(pod)"
        :is-loading-subscription="isLoadingSubscription === pod.id"
        @open="openPodcast(pod)"
        @toggle-play="togglePlayPodcast(pod)"
        @add="addPodcast(pod)"
        @remove="removePodcast(pod)"
      />
    </template>
  </CatalogLayout>
</template>
