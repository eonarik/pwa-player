<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import TrackResolvedItem from '@/components/library/TrackResolvedItem.vue'
import type { LibraryTrack } from '@/types/library'
import type { PlayHistoryEntry } from '@/types/history'
import { formatRelativeTime } from "@/utils/formatRelativeTime"

const history = useHistoryStore()
const library = useLibraryStore()
const player = usePlayerStore()

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
  if (index < 0) return
  player.setQueue(resolvedTracks.value, index)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 class="text-lg font-medium text-fg">История</h1>

        <div class="flex shrink-0 items-center gap-3">
          <span class="text-xs text-fg-muted"> {{ visibleHistory.length }} записей </span>

          <button v-if="!isEmpty" type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="playAll">
            Играть всё
          </button>

          <button v-if="!isEmpty" type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-red-500/10 hover:text-red-400"
            @click="clearHistory">
            Очистить
          </button>
        </div>
      </div>
    </div>

    <!-- Переключатель уникальности -->
    <div v-if="!isEmpty" class="flex shrink-0 items-center gap-2 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl items-center gap-2">
        <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
          :class="showUniqueOnly ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'" @click="showUniqueOnly = true">
          Уникальные
        </button>
        <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
          :class="!showUniqueOnly ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'"
          @click="showUniqueOnly = false">
          Все
        </button>
      </div>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div v-if="isEmpty" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          История пуста
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <TrackResolvedItem v-for="(entry, index) in visibleHistory" :key="`${entry.trackId}-${entry.playedAt}`"
            :track-id="entry.trackId" :index="index" :is-current="isCurrent(entry.trackId)" :is-playing="isPlaying"
            :meta-label="formatRelativeTime(entry.playedAt)"
            @select="onSelectTrack(resolvedTracks.findIndex((t) => t.id === entry.trackId))" />
        </div>
      </div>
    </div>
  </div>
</template>
