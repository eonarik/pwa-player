<!-- src/plugins/radio/RadioCatalog.vue -->
<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { radioService, type RadioStation, type RadioSortOrder, type RadioTag } from './RadioService';
import { type SavedStation } from './index';
import RadioFilters, { type RadioCountryEntry } from './RadioFilters.vue';
import CatalogLayout from '@/components/catalog/CatalogLayout.vue';
import AddRemoveButton from '@/components/ui/AddRemoveButton.vue';
import Icon from '@/components/atoms/Icon.vue';

const props = defineProps<{
  savedStationIds: Set<string>;
  currentTrackTitle: string | null;
  isPlaying: boolean;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'add', station: SavedStation): void;
  (e: 'play', station: SavedStation): void;
  (e: 'remove', station: SavedStation): void;
  (e: 'back'): void;
}>();

const ORDER_LABELS: Record<RadioSortOrder, string> = {
  clickCount: 'Топ чарт',
  votes: 'По голосам',
  clickTrend: 'В тренде',
  bitrate: 'По качеству',
  random: 'Случайные',
  name: 'По алфавиту',
};

const SEARCH_STORAGE_KEY = 'radio:searchQuery';

const searchQuery = ref(localStorage.getItem(SEARCH_STORAGE_KEY) ?? '');
const debouncedSearchQuery = ref(searchQuery.value);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const topLimit = ref(Number(localStorage.getItem('radio:topLimit')) || 15);
const topOrder = ref<RadioSortOrder>((localStorage.getItem('radio:topOrder') as RadioSortOrder) || 'clickCount');
const topCountry = ref(localStorage.getItem('radio:topCountry') || '');
const topTags = ref<string[]>(JSON.parse(localStorage.getItem('radio:topTags') || '[]'));

const offset = ref(0);
const hasMore = ref(true);

const countries = ref<RadioCountryEntry[]>([]);
const tags = ref<RadioTag[]>([]);
const countriesError = ref(false);
const tagsError = ref(false);

const isLoading = ref(false);
const isLoadingMore = ref(false);
const isStale = ref(false);
const error = ref('');
const stations = ref<RadioStation[]>([]);

const isSearchMode = computed(() => debouncedSearchQuery.value.trim().length > 0);
const hasFilters = computed(() => Boolean(topCountry.value) || topTags.value.length > 0);
const activeFiltersCount = computed(() => (topCountry.value ? 1 : 0) + topTags.value.length);

const listTitle = computed(() => {
  if (isSearchMode.value) return `Результаты поиска: «${debouncedSearchQuery.value.trim()}»`;
  if (!hasFilters.value) return `Топ: ${ORDER_LABELS[topOrder.value]}`;
  return 'Топ по фильтрам';
});

function isSaved(id: string) {
  return props.savedStationIds.has(id);
}
function isCurrent(name: string) {
  return props.currentTrackTitle === name;
}
function isStationPlaying(name: string) {
  return isCurrent(name) && props.isPlaying;
}

function toSaved(s: RadioStation): SavedStation {
  return { id: s.id || s.name, name: s.name, url: s.url, favicon: s.favicon };
}

function onAddClick(s: RadioStation) {
  if (!isSaved(s.id)) emit('add', toSaved(s));
}
function onPlayClick(s: RadioStation) {
  emit('play', toSaved(s));
}
function onRemoveClick(s: RadioStation) {
  emit('remove', toSaved(s));
}

async function loadCountries() {
  countriesError.value = false;
  const res = await radioService.getCountries();
  if (res === null) countriesError.value = true;
  else countries.value = res;
}

async function loadTags() {
  tagsError.value = false;
  const res = await radioService.getTags(100);
  if (res === null) tagsError.value = true;
  else tags.value = res;
}

async function loadStations(isMore = false) {
  if (isMore) isLoadingMore.value = true;
  else isLoading.value = true;

  isStale.value = false;
  error.value = '';
  if (!isMore) offset.value = 0;

  try {
    const limit = topLimit.value;
    const query = debouncedSearchQuery.value.trim();

    let result: { stations: RadioStation[]; total: number };
    if (query) {
      result = await radioService.searchByName(query, limit, {
        offset: offset.value,
        countryCode: topCountry.value || undefined,
        tags: topTags.value,
        order: topOrder.value,
      });
    } else {
      result = await radioService.getTopStations(
        limit,
        offset.value,
        topOrder.value,
        topCountry.value || undefined,
        topTags.value,
      );
    }

    if (isMore) {
      stations.value = [...stations.value, ...result.stations];
    } else {
      stations.value = result.stations;
    }

    offset.value += result.stations.length;
    hasMore.value = result.stations.length === limit && result.total > offset.value;
    isStale.value = radioService.isStale;
    if (stations.value.length === 0) error.value = 'Ничего не найдено';
  } catch {
    if (!isMore) stations.value = [];
    error.value = 'Ошибка загрузки';
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
}

function loadMore() {
  if (!isLoadingMore.value && hasMore.value) {
    void loadStations(true);
  }
}

watch(searchQuery, (value) => {
  localStorage.setItem(SEARCH_STORAGE_KEY, value);
  if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null;
    const next = value.trim();
    if (next === debouncedSearchQuery.value.trim()) return;
    debouncedSearchQuery.value = value;
    void loadStations(false);
  }, 500);
});

watch(
  [topOrder, topCountry, topTags, topLimit],
  () => {
    localStorage.setItem('radio:topOrder', topOrder.value);
    localStorage.setItem('radio:topCountry', topCountry.value);
    localStorage.setItem('radio:topTags', JSON.stringify(topTags.value));
    localStorage.setItem('radio:topLimit', String(topLimit.value));
    void loadStations(false);
  },
  { deep: true },
);

onMounted(async () => {
  await Promise.all([loadCountries(), loadTags()]);
  void loadStations(false);
});

function clearSearch() {
  searchQuery.value = '';
  debouncedSearchQuery.value = '';
  localStorage.removeItem(SEARCH_STORAGE_KEY);
  void loadStations(false);
}
</script>

<template>
  <CatalogLayout
    title="Выбор станций"
    back-label="К сохранённым"
    :list-title="listTitle"
    :search-query="searchQuery"
    :show-clear="isSearchMode"
    :is-loading="isLoading"
    :is-loading-more="isLoadingMore"
    :is-stale="isStale"
    :error="error"
    :is-empty="stations.length === 0 && !isLoading && !error"
    :current-limit="topLimit"
    :has-more="hasMore"
    :is-mobile="isMobile"
    :active-filters-count="activeFiltersCount"
    @update:search-query="(v) => (searchQuery = v)"
    @clear="clearSearch"
    @back="emit('back')"
    @update:current-limit="(v) => (topLimit = v)"
    @load-more="loadMore"
  >
    <template #filters>
      <RadioFilters
        v-model:top-order="topOrder"
        v-model:top-country="topCountry"
        v-model:top-tags="topTags"
        :countries="countries"
        :tags="tags"
        :countries-error="countriesError"
        :tags-error="tagsError"
        @retry-countries="loadCountries"
        @retry-tags="loadTags"
      />
    </template>

    <template #error-action>
      <button
        type="button"
        class="rounded-btn bg-card-bg px-4 py-2 text-xs text-fg transition hover:bg-hover-bg"
        @click="() => loadStations(false)"
      >
        Попробовать еще раз
      </button>
    </template>

    <template #list>
      <div
        v-for="station in stations"
        :key="station.id"
        class="group flex items-center justify-between gap-2 rounded-btn px-2 py-2 md:px-3 md:py-2 transition cursor-pointer"
        :class="isCurrent(station.name) ? 'bg-active/10' : 'hover:bg-hover-bg'"
        data-testid="radio-station-row"
        @click="onPlayClick(station)"
      >
        <div class="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-card-bg">
            <img
              v-if="station.favicon"
              :src="station.favicon"
              class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <Icon v-else name="radio" w="w-5" h="h-5" class="text-fg-muted" />
          </div>
          <div class="min-w-0">
            <span class="text-sm text-fg truncate block">{{ station.name }}</span>
            <span v-if="station.country" class="text-[10px] text-fg-muted truncate block">{{ station.country }}</span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1 md:gap-2">
          <button
            v-if="isStationPlaying(station.name)"
            type="button"
            class="rounded-btn px-2 py-2 text-active transition hover:bg-hover-bg"
            aria-label="Пауза"
          >
            <div class="flex items-center justify-center gap-0.5 w-4 h-4">
              <span class="h-3 w-0.5 animate-pulse bg-active" />
              <span class="h-4 w-0.5 animate-pulse bg-active [animation-delay:150ms]" />
              <span class="h-2 w-0.5 animate-pulse bg-active [animation-delay:300ms]" />
            </div>
          </button>
          <button
            v-else
            type="button"
            class="rounded-btn p-2 transition"
            :class="
              isCurrent(station.name)
                ? 'text-active hover:bg-hover-bg'
                : 'text-fg-subtle hover:bg-hover-bg hover:text-fg'
            "
            aria-label="Играть"
          >
            <Icon name="play" w="w-4" h="h-4" />
          </button>

          <!-- Обертка с testid, которую ищет Playwright -->
          <div data-testid="radio-station-add">
            <AddRemoveButton :added="isSaved(station.id)" @add="onAddClick(station)" @remove="onRemoveClick(station)" />
          </div>
        </div>
      </div>
    </template>
  </CatalogLayout>
</template>
