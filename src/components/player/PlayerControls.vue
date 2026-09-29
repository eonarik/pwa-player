<!-- src/components/player/PlayerControls.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import ProgressBar from './ProgressBar.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import IconNext from '@/components/icons/IconNext.vue'
import IconPrev from '@/components/icons/IconPrev.vue'
import IconShuffle from '@/components/icons/IconShuffle.vue'
import IconRepeat from '@/components/icons/IconRepeat.vue'
import IconVolume from '@/components/icons/IconVolume.vue'
import IconVolumeMute from '@/components/icons/IconVolumeMute.vue'

const player = usePlayerStore()
const { currentTrack, isPlaying, currentTime, duration, volume, muted, repeatMode, shuffle } =
  storeToRefs(player)

function onSeek(time: number) {
  player.seek(time)
}

function onVolumeInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  player.setVolume(value)
}
</script>

<template>
  <footer class="grid grid-cols-[1fr_auto] items-center gap-4 bg-bg px-4 py-3 md:grid-cols-[1fr_auto_1fr]">
    <!-- Левая часть: текущий трек -->
    <RouterLink :to="{ name: 'queue' }"
      class="-m-1 flex min-w-0 items-center gap-3 rounded-btn p-1 transition hover:bg-hover-bg">
      <div class="h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-card-bg">
        <img v-if="currentTrack?.coverUrl" :src="currentTrack.coverUrl" :alt="currentTrack.album"
          class="h-full w-full object-cover" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-fg">
          {{ currentTrack?.title ?? 'Ничего не играет' }}
        </p>
        <p class="truncate text-xs text-fg-muted">
          {{ currentTrack?.artist ?? '—' }}
        </p>
      </div>
    </RouterLink>

    <!-- Центр: управление + прогресс -->
    <div class="flex w-[min(600px,45vw)] flex-col items-center gap-2">
      <div class="flex items-center gap-2">
        <button type="button" class="rounded-full p-2 transition" :class="shuffle
          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
          " aria-label="Перемешать" :aria-pressed="shuffle" @click="player.toggleShuffle()">
          <IconShuffle class="h-4 w-4" />
        </button>

        <button type="button" class="rounded-full p-2 text-fg-muted transition hover:text-fg"
          aria-label="Предыдущий трек" @click="player.prev()">
          <IconPrev class="h-5 w-5" />
        </button>

        <button type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-bg transition hover:scale-105"
          :aria-label="isPlaying ? 'Пауза' : 'Играть'" @click="player.toggle()">
          <IconPause v-if="isPlaying" class="h-5 w-5" />
          <IconPlay v-else class="h-5 w-5 translate-x-[1px]" />
        </button>

        <button type="button" class="rounded-full p-2 text-fg-muted transition hover:text-fg"
          aria-label="Следующий трек" @click="player.next()">
          <IconNext class="h-5 w-5" />
        </button>

        <button type="button" class="relative rounded-full p-2 transition" :class="repeatMode !== 'off'
          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
          " :aria-label="`Повтор: ${repeatMode}`" :aria-pressed="repeatMode !== 'off'" @click="player.cycleRepeat()">
          <IconRepeat class="h-4 w-4" />
          <span v-if="repeatMode === 'one'" class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold">
            1
          </span>
        </button>
      </div>

      <ProgressBar :current-time="currentTime" :duration="duration" @seek="onSeek" />
    </div>

    <!-- Правая часть: громкость -->
    <div class="hidden items-center justify-end gap-2 md:flex">
      <button type="button" class="rounded-full p-2 text-fg-muted transition hover:text-fg"
        :aria-label="muted ? 'Включить звук' : 'Выключить звук'" @click="player.toggleMute()">
        <IconVolumeMute v-if="muted || volume === 0" class="h-4 w-4" />
        <IconVolume v-else class="h-4 w-4" />
      </button>

      <input type="range" min="0" max="1" step="0.01" :value="muted ? 0 : volume" aria-label="Громкость"
        class="h-1 w-24 cursor-pointer appearance-none rounded-full bg-hover-bg [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent"
        @input="onVolumeInput" />
    </div>
  </footer>
</template>
