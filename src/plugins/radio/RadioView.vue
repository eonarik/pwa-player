<!-- src/plugins/radio/RadioView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { toastService } from '@/services/ui/ToastService'
import { PLUGIN_ID } from './constants'
import {
  getSavedStations,
  addSavedStation,
  removeSavedStation,
  type SavedStation,
} from './index'
import RadioSavedList from './RadioSavedList.vue'
import RadioCatalog from './RadioCatalog.vue'
import AddStationModal from './AddStationModal.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import type { Track } from '@/types/track'
import { toPlayableUrl } from "@/services/audio/toPlayableUrl.ts"

const player = usePlayerStore()

type ViewMode = 'saved' | 'catalog'
const viewMode = ref<ViewMode>('saved')
const isAddModalOpen = ref(false)

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
  if (savedStationIds.value.has(station.id)) {
    toastService.error(`Станция «${station.name}» уже добавлена`)
    return
  }

  const ok = addSavedStation(station)
  if (!ok) {
    toastService.error('Не удалось сохранить станцию')
    return
  }

  refreshSaved()
  toastService.success(`Станция «${station.name}» добавлена`)
}

function onAddByUrl(station: SavedStation): void {
  onAdd(station)
}

function onPlay(station: SavedStation): void {
  playStation(station)
}

function onRemove(station: SavedStation): void {
  removeSavedStation(station.id)
  refreshSaved()
  toastService.info(`Станция «${station.name}» удалена`)

  if (player.currentTrack?.id === `radio:${station.id}`) {
    player.stop()
  }
}

function onRemoveFromSavedList(station: SavedStation): void {
  const confirmed = window.confirm(`Удалить станцию «${station.name}»?`)
  if (!confirmed) return
  onRemove(station)
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
    source: toPlayableUrl(station.url),
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
    <template v-if="viewMode === 'saved'">
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
        @play="playStation" @remove="onRemoveFromSavedList" @add-by-url="isAddModalOpen = true" />
    </template>

    <RadioCatalog v-else-if="viewMode === 'catalog'" :saved-station-ids="savedStationIds"
      :current-track-id="currentTrackId" :is-playing="player.isPlaying" @add="onAdd" @play="onPlay" @remove="onRemove"
      @back="closeCatalog" />

    <AddStationModal v-if="isAddModalOpen" @close="isAddModalOpen = false" @add="onAddByUrl" />
  </div>
</template>
