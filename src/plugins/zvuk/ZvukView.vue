<!-- src/plugins/zvuk/ZvukView.vue -->

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { usePlayerStore } from '@/stores/player';
import { zvukService, type ZvukTrack, type ZvukSearchType } from './ZvukService';
import SearchInput from '@/components/ui/SearchInput.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import TrackRow from '@/components/library/TrackRow.vue';
import TrackActions from '@/components/library/TrackActions.vue';
import BatchAddToPlaylistButton from '@/components/library/BatchAddToPlaylistButton.vue';
import Icon from '@/components/ui/Icon.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { newTrackId, newTrackSourceId } from '@/types/ids';
import type { Track } from '@/types/track';

const player = usePlayerStore();

const query = ref('');
const searchTypes = ref<ZvukSearchType[]>(['artists']);
const tracks = ref<ZvukTrack[]>([]);
const isLoading = ref(false);
const error = ref('');

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function toggleType(type: ZvukSearchType) {
  if (searchTypes.value.includes(type)) {
    if (searchTypes.value.length > 1) searchTypes.value = searchTypes.value.filter((t) => t !== type);
  } else {
    searchTypes.value = [...searchTypes.value, type];
  }
  if (query.value.trim()) void doSearch();
}

function onSearchInput(value: string) {
  query.value = value;
  if (searchTimeout) clearTimeout(searchTimeout);
  if (!value.trim()) {
    tracks.value = [];
    error.value = '';
    return;
  }
  searchTimeout = setTimeout(() => void doSearch(), 1000);
}

async function doSearch() {
  const q = query.value.trim();
  if (!q) return;
  isLoading.value = true;
  error.value = '';
  try {
    const fetched = await zvukService.search(q, searchTypes.value);
    if (query.value.trim() !== q) return;
    tracks.value = (fetched.tracks || []).filter((t): t is ZvukTrack => t != null);
    if (tracks.value.length === 0) error.value = 'Ничего не найдено';
  } catch (err) {
    if (query.value.trim() !== q) return;
    error.value = err instanceof Error ? err.message : 'Ошибка поиска';
  } finally {
    if (query.value.trim() === q) isLoading.value = false;
  }
}

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});

function toPlayableTrack(zvukTrack: ZvukTrack): Track {
  const coverUrl = zvukTrack.release?.image?.src?.replace('{size}', '400') ?? null;
  const artist = zvukTrack.artists?.map((a) => a.title).join(', ') || 'Звук';
  return {
    id: newTrackId(),
    pluginId: 'zvuk',
    artist,
    title: zvukTrack.title,
    albumId: null,
    coverUrl,
    sources: [
      {
        id: newTrackSourceId(),
        pluginId: 'zvuk',
        priority: 30,
        kind: 'streaming',
        url: zvukService.getStreamUrl(zvukTrack.id),
      },
    ],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
    duration: zvukTrack.duration,
  };
}

const playableTracks = computed(() => tracks.value.map(toPlayableTrack));

function playTrack(index: number) {
  player.setQueue(playableTracks.value, index);
}

function isCurrent(track: ZvukTrack): boolean {
  const t = player.currentTrack;
  if (!t) return false;
  const artist = track.artists?.map((a) => a.title).join(', ') || 'Звук';
  return t.title === track.title && t.artist === artist;
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Звук" subtitle="Поиск по каталогу Звука">
      <BatchAddToPlaylistButton :tracks="playableTracks" />
    </PageHeader>

    <div class="shrink-0 px-4 py-2">
      <div class="mx-auto w-full max-w-3xl flex flex-col gap-3">
        <SearchInput :model-value="query" always-open placeholder="Что ищем?" @update:model-value="onSearchInput" />

        <div class="flex items-center gap-4 text-sm">
          <label class="flex items-center gap-2 cursor-pointer text-fg">
            <input
              type="checkbox"
              :checked="searchTypes.includes('tracks')"
              class="accent-active"
              @change="toggleType('tracks')"
            />
            Искать в треках
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-fg">
            <input
              type="checkbox"
              :checked="searchTypes.includes('artists')"
              class="accent-active"
              @change="toggleType('artists')"
            />
            Искать в артистах
          </label>
          <label class="flex items-center gap-2 cursor-pointer text-fg">
            <input
              type="checkbox"
              :checked="searchTypes.includes('releases')"
              class="accent-active"
              @change="toggleType('releases')"
            />
            Искать в альбомах
          </label>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div v-if="isLoading" class="flex justify-center py-10">
          <Spinner size="lg" text="Ищем..." />
        </div>

        <EmptyState v-else-if="error" :title="error">
          <template #icon>
            <Icon name="search" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <EmptyState v-else-if="!query.trim()" title="Начните вводить запрос">
          <template #icon>
            <Icon name="music" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <div v-else class="flex flex-col gap-0.5">
          <TrackRow
            v-for="(track, index) in tracks"
            :key="track.id"
            :track="toPlayableTrack(track)"
            :index="index"
            :is-current="isCurrent(track)"
            :is-playing="player.isPlaying"
            @select="() => playTrack(index)"
          >
            <template #actions>
              <TrackActions :track="toPlayableTrack(track)" />
            </template>
          </TrackRow>
        </div>
      </div>
    </div>
  </div>
</template>
