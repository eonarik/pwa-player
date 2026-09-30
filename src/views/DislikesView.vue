<!-- src/views/DislikesView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useDislikesStore } from '@/stores/dislikes'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import TrackResolvedItem from '@/components/library/TrackResolvedItem.vue'
import IconEyeOff from '@/components/icons/IconEyeOff.vue'
import type { LibraryTrack } from '@/types/library'
import { formatRelativeTime } from "@/utils/formatRelativeTime"

const dislikes = useDislikesStore()
const library = useLibraryStore()
const player = usePlayerStore()

const { sortedEntries } = storeToRefs(dislikes)
const { currentTrack, isPlaying } = storeToRefs(player)

const isEmpty = computed(() => sortedEntries.value.length === 0)

const resolvedTracks = computed<LibraryTrack[]>(() => {
  const result: LibraryTrack[] = []
  for (const entry of sortedEntries.value) {
    const track = library.getTrack(entry.trackId)
    if (track) result.push(track)
  }
  return result
})

function playAll() {
  if (resolvedTracks.value.length === 0) return
  player.setQueue(resolvedTracks.value, 0)
}

function onSelectTrack(trackId: string) {
  const idx = resolvedTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(resolvedTracks.value, idx)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}

function clearDislikes() {
  const confirmed = window.confirm('Очистить список дизлайков?')
  if (!confirmed) return
  dislikes.clear()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 class="text-lg font-medium text-fg">Дизлайки</h1>

        <div class="flex shrink-0 items-center gap-3">
          <span class="text-xs text-fg-muted">{{ sortedEntries.length }} треков</span>

          <button v-if="!isEmpty" type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="playAll">
            Играть всё
          </button>

          <button v-if="!isEmpty" type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-red-500/10 hover:text-red-400"
            @click="clearDislikes">
            Очистить
          </button>
        </div>
      </div>
    </div>

    <!-- Список -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div v-if="isEmpty" class="flex h-full flex-col items-center justify-center gap-3 py-20 text-sm text-fg-muted">
          <IconEyeOff class="h-10 w-10 text-fg-subtle" />
          <p>Дизлайков пока нет</p>
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <TrackResolvedItem v-for="(entry, index) in sortedEntries" :key="entry.trackId" :track-id="entry.trackId"
            :index="index" :is-current="isCurrent(entry.trackId)" :is-playing="isPlaying"
            :meta-label="formatRelativeTime(entry.dislikedAt)" @select="onSelectTrack(entry.trackId)" />
        </div>
      </div>
    </div>
  </div>
</template>
