<!-- src/views/QueueView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import type { Track } from '@/types/track'

const player = usePlayerStore()
const { queue, currentIndex, currentTrack, isPlaying } = storeToRefs(player)

const hasQueue = computed(() => queue.value.length > 0)

function playAt(index: number) {
  player.playAt(index)
}

function removeAt(index: number, e: Event) {
  e.stopPropagation()
  player.removeFromQueue(index)
}

function clearQueue() {
  const confirmed = window.confirm('Очистить очередь воспроизведения?')
  if (!confirmed) return
  player.clearQueue()
}

function isCurrent(index: number): boolean {
  return index === currentIndex.value
}

function durationLabel(track: Track): string {
  const d = track.duration
  if (!d || !Number.isFinite(d)) return '--:--'
  const total = Math.floor(d)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <div class="min-w-0">
        <h1 class="text-lg font-medium text-zinc-100">Очередь</h1>
        <p class="text-xs text-zinc-500">
          <template v-if="hasQueue">
            {{ queue.length }} треков
            <template v-if="currentTrack">
              · играет {{ currentIndex + 1 }}-й
            </template>
          </template>
          <template v-else>пусто</template>
        </p>
      </div>

      <button v-if="hasQueue" type="button"
        class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-red-400"
        @click="clearQueue">
        Очистить
      </button>
    </div>

    <!-- Пусто -->
    <div v-if="!hasQueue" class="flex flex-1 items-center justify-center text-sm text-zinc-500">
      Очередь пуста. Запустите трек или папку — они появятся здесь.
    </div>

    <!-- Список -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="flex flex-col gap-0.5 p-2">
        <div v-for="(track, index) in queue" :key="`${track.id}-${index}`"
          class="group relative flex items-center gap-3 rounded-lg px-3 py-2 transition" :class="isCurrent(index)
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-zinc-300 hover:bg-zinc-800/60'
            ">
          <!-- Клик по строке — играть -->
          <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="playAt(index)">
            <!-- Обложка / индекс -->
            <div
              class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-800">
              <img v-if="track.coverUrl" :src="track.coverUrl" :alt="track.album" class="h-full w-full object-cover"
                loading="lazy" />
              <span v-else class="text-xs font-medium text-zinc-500">
                {{ index + 1 }}
              </span>

              <!-- Индикатор «играет сейчас» -->
              <div v-if="isCurrent(index) && isPlaying"
                class="absolute inset-0 flex items-center justify-center bg-black/50">
                <span class="flex gap-0.5">
                  <span class="h-3 w-0.5 animate-pulse bg-emerald-400" />
                  <span class="h-4 w-0.5 animate-pulse bg-emerald-400 [animation-delay:150ms]" />
                  <span class="h-2 w-0.5 animate-pulse bg-emerald-400 [animation-delay:300ms]" />
                </span>
              </div>
            </div>

            <!-- Название и артист -->
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ track.title }}
                <span v-if="isCurrent(index) && !isPlaying" class="ml-1 text-xs text-emerald-400/70">
                  (пауза)
                </span>
              </p>
              <p class="truncate text-xs text-zinc-500">{{ track.artist }}</p>
            </div>

            <!-- Длительность -->
            <span class="shrink-0 text-xs tabular-nums text-zinc-500">
              {{ durationLabel(track) }}
            </span>
          </button>

          <!-- Удалить -->
          <button type="button"
            class="shrink-0 rounded-md p-1.5 text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Убрать из очереди" @click="removeAt(index, $event)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
