<!-- src/plugins/radio/RadioView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { PLUGIN_ID } from './constants'
import {
  getSavedStations,
  addSavedStation,
  removeSavedStation,
  type SavedStation,
} from './index'
import RadioSavedList from './RadioSavedList.vue'
import RadioCatalog from './RadioCatalog.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import type { Track } from '@/types/track'

const player = usePlayerStore()

type ViewMode = 'saved' | 'catalog'
const viewMode = ref<ViewMode>('saved')

const savedStations = ref<SavedStation[]>(getSavedStations())

const savedStationIds = computed(() => new Set(savedStations.value.map((s) => s.id)))

const currentTrackId = computed(() => player.currentTrack?.id ?? null)

function refreshSaved(): void {
  savedStations.value = getSavedStations()
}

function openCatalog(): void {
  viewMode.value = 'catalog'
}

function closeCatalog(): void {
  viewMode.value = 'saved'
}

function onAdd(station: SavedStation): void {
  const ok = addSavedStation(station)
  if (!ok) {
    console.warn('[radio] station not persisted, localStorage unavailable')
  }

  refreshSaved()
  closeCatalog()
  playStation(station)
}

function onRemove(station: SavedStation): void {
  const confirmed = window.confirm(`Удалить станцию «${station.name}»?`)
  if (!confirmed) return

  removeSavedStation(station.id)
  refreshSaved()

  if (player.currentTrack?.id === `radio:${station.id}`) {
    player.stop()
  }
}

function playStation(station: SavedStation): void {
  if (player.currentTrack?.id === `radio:${station.id}`) {
    player.toggle()
    return
  }

  const track: Track = {
    id: `radio:${station.id}`,
    pluginId: PLUGIN_ID,
    title: station.name,
    artist: '',
    album: '',
    duration: 0,
    filename: '',
    source: station.url,
    coverUrl: station.favicon || undefined,
  }

  player.setQueue([track], 0)
}

onMounted(() => {
  refreshSaved()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Режим "Мои станции" -->
    <template v-if="viewMode === 'saved'">
      <!-- Шапка -->
      <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-10">
        <div class="mx-auto flex w-full max-w-3xl items-center justify-between">
          <h1 class="text-lg font-medium text-fg">Радиостанции</h1>
          <button type="button"
            class="flex items-center gap-2 rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="openCatalog">
            <IconPlus class="h-4 w-4" />
            Добавить станции
          </button>
        </div>
      </div>

      <RadioSavedList :stations="savedStations" :current-track-id="currentTrackId" :is-playing="player.isPlaying"
        @play="playStation" @remove="onRemove" />
    </template>

    <!-- Режим "Каталог" -->
    <RadioCatalog v-else-if="viewMode === 'catalog'" :saved-station-ids="savedStationIds" @add="onAdd"
      @back="closeCatalog" />
  </div>
</template>
