// src/plugins/podcasts/composables/usePodcastCatalog.ts

import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import { podcastService } from '../PodcastService';
import type { Podcast } from '../types';
import { PODCAST_COUNTRIES as COUNTRIES, PODCAST_GENRES as GENRES } from '../constants';

const COUNTRY_KEY = 'podcasts:country';
const GENRE_KEY = 'podcasts:genre';
const SEARCH_KEY = 'podcasts:searchQuery';
const LIMIT_KEY = 'podcasts:topLimit';

const MAX_TOP_SIZE = 200;
const SEARCH_RESULT_LIMIT = 20;
const DEBOUNCE_MS = 500;
const DEFAULT_COUNTRY = 'ru';
const DEFAULT_LIMIT = 15;
const ALL_GENRES_LABEL = 'Все жанры';

/**
 * Состояние каталога подкастов: фильтры, поиск с дебаунсом, постраничный топ.
 * Подписки и воспроизведение — в `usePodcastSubscriptions` / `usePodcastPlayback`.
 */
export function usePodcastCatalog() {
  const country = ref(localStorage.getItem(COUNTRY_KEY) || DEFAULT_COUNTRY);
  const genre = ref(localStorage.getItem(GENRE_KEY) || '');
  const searchQuery = ref(localStorage.getItem(SEARCH_KEY) || '');
  const debouncedQuery = ref(searchQuery.value);
  const topLimit = ref(Number(localStorage.getItem(LIMIT_KEY)) || DEFAULT_LIMIT);

  const currentPage = ref(1);
  const hasMore = ref(true);

  const isLoading = ref(false);
  const isStale = ref(false);
  const error = ref('');
  const podcasts = ref<Podcast[]>([]);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const isSearchMode = computed(() => debouncedQuery.value.trim().length > 0);

  const listTitle = computed(() => {
    if (isSearchMode.value) return `Поиск: «${debouncedQuery.value.trim()}»`;
    const countryLabel = COUNTRIES.find((x) => x.code === country.value)?.label ?? country.value;
    const genreLabel = GENRES.find((x) => x.id === genre.value)?.label ?? '';
    return genreLabel && genreLabel !== ALL_GENRES_LABEL
      ? `Топ: ${genreLabel} (${countryLabel})`
      : `Топ подкастов (${countryLabel})`;
  });

  /**
   * Топ отдаётся целиком за один запрос, поэтому страница берётся срезом из
   * уже полученного списка: fetchLimit = page * topLimit, но не больше MAX_TOP_SIZE.
   */
  async function loadTop(page = 1): Promise<void> {
    isLoading.value = true;
    isStale.value = false;
    error.value = '';
    try {
      const fetchLimit = Math.min(page * topLimit.value, MAX_TOP_SIZE);
      const all = await podcastService.getTopPodcasts(country.value, genre.value || undefined, fetchLimit);
      if (all.length === 0) {
        podcasts.value = [];
        hasMore.value = false;
        error.value = 'Не удалось загрузить топ';
        return;
      }
      podcasts.value = all.slice((page - 1) * topLimit.value, page * topLimit.value);
      hasMore.value = all.length >= fetchLimit && fetchLimit < MAX_TOP_SIZE;
    } catch {
      podcasts.value = [];
      hasMore.value = false;
      error.value = 'Не удалось загрузить топ';
    } finally {
      isLoading.value = false;
    }
  }

  async function loadSearch(query: string): Promise<void> {
    isLoading.value = true;
    isStale.value = false;
    error.value = '';
    try {
      const data = await podcastService.searchItunes(query, SEARCH_RESULT_LIMIT);
      podcasts.value = data;
      hasMore.value = false;
      if (data.length === 0) error.value = 'Ничего не найдено';
    } catch {
      podcasts.value = [];
      error.value = 'Ошибка поиска';
    } finally {
      isLoading.value = false;
    }
  }

  async function load(): Promise<void> {
    if (isSearchMode.value) await loadSearch(debouncedQuery.value.trim());
    else await loadTop(currentPage.value);
  }

  function clearSearch(): void {
    searchQuery.value = '';
    debouncedQuery.value = '';
    localStorage.removeItem(SEARCH_KEY);
    currentPage.value = 1;
    void loadTop(currentPage.value);
  }

  function retryLoad(): void {
    if (isSearchMode.value) void loadSearch(debouncedQuery.value.trim());
    else void loadTop(currentPage.value);
  }

  watch(searchQuery, (value) => {
    localStorage.setItem(SEARCH_KEY, value);
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchTimer = null;
      if (value.trim() === debouncedQuery.value.trim()) return;
      debouncedQuery.value = value;
      currentPage.value = 1;
      void load();
    }, DEBOUNCE_MS);
  });

  watch([country, genre, topLimit], () => {
    localStorage.setItem(COUNTRY_KEY, country.value);
    localStorage.setItem(GENRE_KEY, genre.value);
    localStorage.setItem(LIMIT_KEY, String(topLimit.value));
    currentPage.value = 1;
    if (!isSearchMode.value) void loadTop(currentPage.value);
  });

  watch(currentPage, (page) => {
    if (isSearchMode.value) return;
    void loadTop(page);
  });

  // Компонент мог размонтироваться, пока дебаунс ещё не сработал.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
    });
  }

  return {
    country,
    genre,
    searchQuery,
    debouncedQuery,
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
    loadTop,
    loadSearch,
    clearSearch,
    retryLoad,
  };
}
