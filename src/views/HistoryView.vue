<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import type { LibraryTrack } from '@/types/library'
import type { PlayHistoryEntry } from '@/types/history'

const history = useHistoryStore()
const library = useLibraryStore()
const player = usePlayerStore()

const { uniqueHistory, isEmpty } = storeToRefs(history)
const { currentTrack, isPlaying } = storeToRefs(player)

const showUniqueOnly = ref(true)

const visibleHistory = computed<PlayHistoryEntry[]>(() => {
  return showUniqueOnly.value ? uniqueHistory.value : history.sortedHistory
})

/** Резолвим записи в реальные треки библиотеки (только доступные) */
const resolvedTracks = computed<LibraryTrack[]>(() => {
  return visibleHistory.value
    .map((entry) => library.getTrack(entry.trackId))
    .filter((t): t is LibraryTrack => Boolean(t))
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

function isCurrent(track: LibraryTrack): boolean {
  return currentTrack.value?.id === track.id
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
    <!-- Шапка -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"
    >
      <h1 class="text-lg font-medium text-zinc-100">История</h1>

      <div class="flex shrink-0 items-center gap-3">
        <span class="text-xs text-zinc-500"> {{ visibleHistory.length }} записей </span>

        <button
          v-if="!isEmpty"
          type="button"
          class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
          @click="playAll"
        >
          Играть всё
        </button>

        <button
          v-if="!isEmpty"
          type="button"
          class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          @click="clearHistory"
        >
          Очистить
        </button>
      </div>
    </div>

    <!-- Переключатель уникальности -->
    <div
      v-if="!isEmpty"
      class="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2"
    >
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs transition"
        :class="showUniqueOnly ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
        @click="showUniqueOnly = true"
      >
        Уникальные
      </button>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs transition"
        :class="!showUniqueOnly ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'"
        @click="showUniqueOnly = false"
      >
        Все
      </button>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-zinc-500">
        История пуста
      </div>

      <div v-else class="flex flex-col gap-0.5 p-2">
        <template
          v-for="(entry, index) in visibleHistory"
          :key="`${entry.trackId}-${entry.playedAt}`"
        >
          <!-- Доступный трек -->
          <TrackListItem
            v-if="library.getTrack(entry.trackId)"
            :track="library.getTrack(entry.trackId)!"
            :index="index"
            :is-current="isCurrent(library.getTrack(entry.trackId)!)"
            :is-playing="isPlaying"
            @select="() => onSelectTrack(resolvedTracks.indexOf(library.getTrack(entry.trackId)!))"
          >
            <template #actions>
              <span class="mr-2 text-[10px] tabular-nums text-zinc-600">
                {{ formatTime(entry.playedAt) }}
              </span>
              <TrackActions :track="library.getTrack(entry.trackId)!" />
            </template>
          </TrackListItem>

          <!-- Недоступный трек -->
          <div v-else class="flex items-center gap-3 rounded-lg px-3 py-2 text-zinc-600">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zinc-800/50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="h-4 w-4"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm line-through">{{ entry.title }}</p>
              <p class="truncate text-xs">{{ entry.artist }} · Источник недоступен</p>
            </div>
            <span class="text-[10px] tabular-nums text-zinc-700">
              {{ formatTime(entry.playedAt) }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
