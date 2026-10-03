<!-- src/views/QueueView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { pluralize } from '@/utils/pluralize'
import QueueTrackRow from '@/components/queue/QueueTrackRow.vue'

const player = usePlayerStore()
const { queue, currentIndex, currentTrack, isPlaying } = storeToRefs(player)

const hasQueue = computed(() => queue.value.length > 0)

function playAt(index: number) {
  player.playAt(index)
}

function removeAt(index: number) {
  player.removeFromQueue(index)
}

function clearQueue() {
  const confirmed = window.confirm('Очистить очередь воспроизведения?')
  if (!confirmed) return
  player.clearQueue()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <h1 class="text-lg font-medium text-fg">Очередь</h1>
        <p class="text-xs text-fg-muted">
          <template v-if="hasQueue">
            {{ pluralize(queue.length, ['трек', 'трека', 'треков']) }}
            <template v-if="currentTrack"> · играет {{ currentIndex + 1 }}-й</template>
          </template>
          <template v-else>пусто</template>
        </p>
      </div>

      <button
        v-if="hasQueue"
        type="button"
        class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-red-500/10 hover:text-red-400"
        @click="clearQueue"
      >
        Очистить
      </button>
    </div>

    <!-- Пусто -->
    <div v-if="!hasQueue" class="flex flex-1 items-center justify-center text-sm text-fg-muted">
      Очередь пуста. Запустите трек или папку — они появятся здесь.
    </div>

    <!-- Список -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-0.5 p-2">
        <QueueTrackRow
          v-for="(track, index) in queue"
          :key="`${track.id}-${index}`"
          :track="track"
          :index="index"
          :is-current="index === currentIndex"
          :is-playing="isPlaying"
          @select="playAt(index)"
          @remove="removeAt(index)"
        />
      </div>
    </div>
  </div>
</template>
