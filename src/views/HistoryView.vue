<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { usePlayerStore } from '@/stores/player'
import TrackResolvedItem from '@/components/library/TrackResolvedItem.vue'
import type { LibraryTrack } from '@/types/library'
import type { PlayHistoryEntry } from '@/types/history'
import { useLibraryStore } from "@/stores/library"

const history = useHistoryStore()
const player = usePlayerStore()
const library = useLibraryStore()

const { uniqueHistory, isEmpty } = storeToRefs(history)
const { currentTrack, isPlaying } = storeToRefs(player)

const showUniqueOnly = ref(true)

const visibleHistory = computed<PlayHistoryEntry[]>(() => {
  return showUniqueOnly.value ? uniqueHistory.value : history.sortedHistory
})

/** Список доступных треков в порядке отображения — для playAll / onSelect */
const resolvedTracks = computed<LibraryTrack[]>(() => {
  const result: LibraryTrack[] = []
  for (const entry of visibleHistory.value) {
    const track = library.getTrack(entry.trackId)
    if (track) result.push(track)
  }
  return result
})

function clearHistory() {
  const confirmed = window.confirm('Очистить всю историю воспроизведения?')
  if (!confirmed) return
  history.clear()
}

function playAll() {
  if (resolvedTracks.value.length === 0) return
  player.setQueue(resolvedTracks.value, 0)
}

function onSelectTrack(index: number) {
  player.setQueue(resolvedTracks.value, index)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`

  return new Date(ts).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка без изменений -->
    ...

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-zinc-500">
        История пуста
      </div>

      <div v-else class="flex flex-col gap-0.5 p-2">
        <TrackResolvedItem v-for="(entry, index) in visibleHistory" :key="`${entry.trackId}-${entry.playedAt}`"
          :track-id="entry.trackId" :index="index" :is-current="isCurrent(entry.trackId)" :is-playing="isPlaying"
          :meta-label="formatTime(entry.playedAt)"
          @select="() => onSelectTrack(resolvedTracks.findIndex((t) => t.id === entry.trackId))" />
      </div>
    </div>
  </div>
</template>
