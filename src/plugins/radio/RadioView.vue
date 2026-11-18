<!-- src/plugins/radio/RadioView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSwipe } from '@vueuse/core';
import { useMediaQuery } from '@/composables/useMediaQuery';
import { usePlayerStore } from '@/stores/player';
import { toastService } from '@/services/ui/ToastService';
import { PLUGIN_ID } from './constants';
import { getSavedStations, addSavedStation, removeSavedStation, type SavedStation } from './index';
import RadioSavedList from './RadioSavedList.vue';
import RadioCatalog from './RadioCatalog.vue';
import AddStationModal from './AddStationModal.vue';
import Button from '@/components/atoms/Button.vue';
import Icon from '@/components/atoms/Icon.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import { newTrackId, newTrackSourceId } from '@/types/ids';
import type { Track } from '@/types/track';

const player = usePlayerStore();
const isMobile = useMediaQuery('(max-width: 767px)');

const pageIndex = ref(0); // 0 - saved, 1 - catalog
const isAddModalOpen = ref(false);
const savedStations = ref<SavedStation[]>(getSavedStations());
const savedStationIds = computed(() => new Set(savedStations.value.map((s) => s.id)));
const currentTrackTitle = computed(() => player.currentTrack?.title ?? null);

const carouselRef = ref<HTMLElement | null>(null);

useSwipe(carouselRef, {
  passive: false,
  onSwipeEnd(_e, direction) {
    if (!isMobile.value) return;
    if (direction === 'left' && pageIndex.value === 0) pageIndex.value = 1;
    else if (direction === 'right' && pageIndex.value === 1) pageIndex.value = 0;
  },
});

function refreshSaved() {
  savedStations.value = getSavedStations();
}

function goToCatalog() {
  pageIndex.value = 1;
}

function goToSaved() {
  pageIndex.value = 0;
  refreshSaved();
}

function onAdd(station: SavedStation) {
  if (savedStationIds.value.has(station.id)) {
    toastService.error(`Станция «${station.name}» уже добавлена`);
    return;
  }
  if (!addSavedStation(station)) {
    toastService.error('Не удалось сохранить станцию');
    return;
  }
  refreshSaved();
  toastService.success(`Станция «${station.name}» добавлена`);
}

function onRemove(station: SavedStation) {
  removeSavedStation(station.id);
  refreshSaved();
  toastService.info(`Станция «${station.name}» удалена`);
  if (player.currentTrack?.title === station.name && player.currentTrack?.pluginId === PLUGIN_ID) {
    player.stop();
  }
}

function onRemoveFromSavedList(station: SavedStation) {
  if (!window.confirm(`Удалить станцию «${station.name}»?`)) return;
  onRemove(station);
}

function proxyRadioUrl(url: string): string {
  if (url.includes('.m3u8')) return `/api/hls-proxy?url=${encodeURIComponent(url)}`;
  return url;
}

function playStation(station: SavedStation) {
  if (player.currentTrack?.title === station.name && player.currentTrack?.pluginId === PLUGIN_ID) {
    player.toggle();
    return;
  }
  const track: Track = {
    id: newTrackId(),
    pluginId: PLUGIN_ID,
    artist: '',
    title: station.name,
    albumId: null,
    coverUrl: station.favicon || null,
    sources: [
      {
        id: newTrackSourceId(),
        pluginId: PLUGIN_ID,
        priority: 20,
        kind: 'streaming',
        url: proxyRadioUrl(station.url),
      },
    ],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
  };
  player.setQueue([track], 0);
}

onMounted(() => {
  pageIndex.value = 0;
  refreshSaved();
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden relative">
    <!-- Глобальный хедер (общий для обеих страниц) -->
    <div class="flex shrink-0 items-center gap-2 px-4 py-3 border-b border-hover-bg bg-bg z-20">
      <IconButton
        v-if="pageIndex === 1"
        icon="arrow-left"
        variant="ghost"
        size="sm"
        label="Назад"
        data-testid="catalog-back"
        @click="goToSaved"
      />

      <h1 class="text-lg font-medium text-fg flex-1 truncate">
        {{ pageIndex === 0 ? 'Радиостанции' : 'Выбор станций' }}
      </h1>

      <Button v-if="pageIndex === 0" variant="primary" size="sm" data-testid="radio-add-stations" @click="goToCatalog">
        <Icon name="plus" w="w-4" h="h-4" />
        <span class="hidden sm:inline">Добавить станции</span>
        <span class="sm:hidden">Добавить</span>
      </Button>
    </div>

    <!-- МОБИЛКА: Карусель (дети w-full shrink-0) -->
    <div v-if="isMobile" ref="carouselRef" class="flex flex-1 w-full overflow-hidden">
      <div
        class="flex h-full w-full transition-transform duration-300 ease-out"
        :style="{ transform: `translateX(-${pageIndex * 100}%)` }"
      >
        <div class="w-full shrink-0 h-full bg-bg overflow-hidden">
          <RadioSavedList
            :stations="savedStations"
            :current-track-title="currentTrackTitle"
            :is-playing="player.isPlaying"
            @play="playStation"
            @remove="onRemoveFromSavedList"
            @add-by-url="isAddModalOpen = true"
          />
        </div>
        <div class="w-full shrink-0 h-full bg-bg overflow-hidden">
          <RadioCatalog
            :saved-station-ids="savedStationIds"
            :current-track-title="currentTrackTitle"
            :is-playing="player.isPlaying"
            :is-mobile="isMobile"
            @add="onAdd"
            @play="playStation"
            @remove="onRemove"
            @back="goToSaved"
          />
        </div>
      </div>
    </div>

    <!-- ДЕСКТОП: Обычное переключение экранов -->
    <div v-else class="flex-1 w-full overflow-hidden">
      <RadioSavedList
        v-if="pageIndex === 0"
        :stations="savedStations"
        :current-track-title="currentTrackTitle"
        :is-playing="player.isPlaying"
        @play="playStation"
        @remove="onRemoveFromSavedList"
        @add-by-url="isAddModalOpen = true"
      />
      <RadioCatalog
        v-else
        :saved-station-ids="savedStationIds"
        :current-track-title="currentTrackTitle"
        :is-playing="player.isPlaying"
        :is-mobile="isMobile"
        @add="onAdd"
        @play="playStation"
        @remove="onRemove"
        @back="goToSaved"
      />
    </div>

    <!-- Индикатор страниц (точки) только на мобилке -->
    <div
      v-if="isMobile"
      class="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex items-center justify-center gap-2"
    >
      <button
        v-for="i in 2"
        :key="i - 1"
        type="button"
        class="pointer-events-auto h-2 w-2 rounded-full transition"
        :class="pageIndex === i - 1 ? 'bg-active' : 'bg-fg-subtle/40'"
        :aria-label="`Страница ${i}`"
        @click="pageIndex = i - 1"
      />
    </div>

    <AddStationModal v-if="isAddModalOpen" @close="isAddModalOpen = false" @add="onAdd" />
  </div>
</template>
