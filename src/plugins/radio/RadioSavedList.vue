<!-- src/plugins/radio/RadioSavedList.vue -->
<script setup lang="ts">
import IconPlay from '@/components/icons/IconPlay.vue'
import IconRadio from '@/components/icons/IconRadio.vue'
import IconX from '@/components/icons/IconX.vue'
import type { SavedStation } from './index'
import SectionTitle from "@/components/ui/SectionTitle.vue";

defineProps<{
  stations: SavedStation[]
  currentTrackId: string | null
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'play', station: SavedStation): void
  (e: 'remove', station: SavedStation): void
}>()

function isCurrent(station: SavedStation, currentTrackId: string | null): boolean {
  return currentTrackId === `radio:${station.id}`
}

function isStationPlaying(
  station: SavedStation,
  currentTrackId: string | null,
  isPlaying: boolean,
): boolean {
  return isCurrent(station, currentTrackId) && isPlaying
}

function onRemove(station: SavedStation, e: Event): void {
  e.stopPropagation()
  emit('remove', station)
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl py-2 pt-4">
      <SectionTitle text="Мои станции" />

      <div v-if="stations.length === 0" class="flex flex-col items-center justify-center py-20 text-sm text-fg-muted">
        <IconRadio class="mb-3 h-10 w-10 text-fg-subtle" />
        <p>Вы пока не добавили ни одной станции.</p>
      </div>

      <div v-else class="flex flex-col gap-0.5">
        <div v-for="station in stations" :key="station.id"
          class="group flex items-center gap-3 rounded-btn px-3 py-2 transition hover:bg-hover-bg cursor-pointer"
          :class="isCurrent(station, currentTrackId) ? 'bg-active/10' : ''" @click="emit('play', station)">
          <div
            class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
            <img v-if="station.favicon" :src="station.favicon" class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <IconRadio v-else class="h-5 w-5 text-fg-muted" />
            <div
              class="absolute inset-0 flex items-center justify-center bg-bg/50 opacity-0 transition group-hover:opacity-100">
              <IconPlay class="h-5 w-5 text-fg translate-x-[1px]" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium"
              :class="isCurrent(station, currentTrackId) ? 'text-active' : 'text-fg'">
              {{ station.name }}
            </p>
          </div>

          <div v-if="isStationPlaying(station, currentTrackId, isPlaying)" class="flex shrink-0 items-center gap-1">
            <span class="h-3 w-0.5 animate-pulse bg-active" />
            <span class="h-4 w-0.5 animate-pulse bg-active [animation-delay:150ms]" />
            <span class="h-2 w-0.5 animate-pulse bg-active [animation-delay:300ms]" />
          </div>

          <button v-else type="button"
            class="rounded-btn p-1.5 text-fg-subtle opacity-0 transition hover:bg-hover-bg hover:text-red-400 group-hover:opacity-100"
            aria-label="Удалить станцию" @click="onRemove(station, $event)">
            <IconX class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
