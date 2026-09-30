<!-- src/components/player/PlayerControls.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import PlayerProgressBar from './PlayerProgressBar.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import IconNext from '@/components/icons/IconNext.vue'
import IconPrev from '@/components/icons/IconPrev.vue'
import IconShuffle from '@/components/icons/IconShuffle.vue'
import IconRepeat from '@/components/icons/IconRepeat.vue'
import IconVolume from '@/components/icons/IconVolume.vue'
import IconVolumeMute from '@/components/icons/IconVolumeMute.vue'
import IconList from '@/components/icons/IconList.vue'
import TrackReactionButtons from "../ui/TrackReactionButtons.vue"

const emit = defineEmits<{
  (e: 'open'): void
}>()

const player = usePlayerStore()
const { currentTrack, isPlaying, currentTime, duration, volume, muted, repeatMode, shuffle } =
  storeToRefs(player)

// --- Coarse pointer (мобилка) для пропсов прогресса ------------------

const isCoarsePointer = ref(false)
let mql: MediaQueryList | null = null

function updateCoarse() {
  if (mql) isCoarsePointer.value = mql.matches
}

onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  mql = window.matchMedia('(hover: none), (pointer: coarse)')
  updateCoarse()
  mql.addEventListener('change', updateCoarse)
})

onUnmounted(() => {
  if (mql) mql.removeEventListener('change', updateCoarse)
})

// --- Громкость -------------------------------------------------------

const volumePercent = computed(() =>
  muted.value ? 0 : Math.round(volume.value * 100),
)

function onSeek(time: number) {
  player.seek(time)
}

function onVolumeInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  // Драг слайдера при mute — снимаем mute, чтобы пользователь услышал результат
  if (value > 0 && muted.value) {
    player.toggleMute()
  }
  player.setVolume(value)
}

function onFooterClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isOpenTrigger = target.closest('[data-player-open]') !== null
  if (!isOpenTrigger && target.closest('button, a, input, [role="button"]')) return
  emit('open')
}
</script>

<template>
  <footer class="w-full bg-bg" @click="onFooterClick">
    <!-- Прогресс: на мобилке клик уходит в footer → FullPlayer.
         На десктопе интерактивен + растёт на hover. -->
    <PlayerProgressBar :current-time="currentTime" :duration="duration" size="sm" :interactive="!isCoarsePointer"
      :expand-on-hover="!isCoarsePointer" :show-time-on-hover="!isCoarsePointer" time-position="floating"
      @seek="onSeek" />

    <!-- === Мобильная версия === -->
    <div class="grid grid-cols-[1fr_auto] items-stretch md:hidden">
      <button type="button" data-player-open class="flex min-w-0 items-center gap-3 pl-2 text-left"
        :aria-label="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'">
        <div class="aspect-square h-16 w-16 shrink-0 overflow-hidden bg-card-bg">
          <img v-if="currentTrack?.coverUrl" :src="currentTrack.coverUrl" :alt="currentTrack.album"
            class="h-full w-full object-cover" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-base font-medium text-fg">
            {{ currentTrack?.title ?? 'Ничего не играет' }}
          </p>
          <p v-if="currentTrack?.artist" class="truncate text-xs text-fg-muted">
            {{ currentTrack.artist }}
          </p>
        </div>
      </button>

      <div class="flex items-center pr-2">
        <button type="button" class="rounded-full p-2 text-fg-muted transition hover:text-fg"
          aria-label="Предыдущий трек" @click="player.prev()">
          <IconPrev class="h-6 w-6" />
        </button>

        <button type="button" class="rounded-full p-2 text-fg transition hover:text-fg-muted"
          :aria-label="isPlaying ? 'Пауза' : 'Играть'" @click="player.toggle()">
          <IconPause v-if="isPlaying" class="h-7 w-7" />
          <IconPlay v-else class="h-7 w-7 translate-x-[1px]" />
        </button>

        <button type="button" class="rounded-full p-2 text-fg-muted transition hover:text-fg"
          aria-label="Следующий трек" @click="player.next()">
          <IconNext class="h-6 w-6" />
        </button>
      </div>
    </div>

    <!-- === Десктопная версия === -->
    <div class="hidden w-full items-stretch md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <!-- Левая часть: cover | title/artist | favorite -->
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" data-player-open class="flex min-w-0 items-center gap-3 text-left"
          :aria-label="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'">
          <div class="aspect-square h-16 w-16 shrink-0 overflow-hidden bg-card-bg">
            <img v-if="currentTrack?.coverUrl" :src="currentTrack.coverUrl" :alt="currentTrack.album"
              class="h-full w-full object-cover" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-base font-medium text-fg">
              {{ currentTrack?.title ?? 'Ничего не играет' }}
            </p>
            <p class="truncate text-sm text-fg-muted">
              {{ currentTrack?.artist ?? '—' }}
            </p>
          </div>
        </button>

        <TrackReactionButtons :track="currentTrack" size="md" dislike-mode="skip" />
      </div>

      <!-- Центр: shuffle | prev | play | next | repeat -->
      <div class="flex items-center justify-center gap-1">
        <button type="button" class="rounded-btn p-2 transition"
          :class="shuffle ? 'text-active' : 'text-fg-muted hover:text-fg'" :aria-pressed="shuffle"
          aria-label="Перемешать" @click="player.toggleShuffle()">
          <IconShuffle class="h-5 w-5" />
        </button>

        <button type="button" class="rounded-btn p-2 text-fg-muted transition hover:text-fg"
          aria-label="Предыдущий трек" @click="player.prev()">
          <IconPrev class="h-6 w-6" />
        </button>

        <button type="button" class="rounded-btn p-2 text-fg transition hover:text-fg-muted"
          :aria-label="isPlaying ? 'Пауза' : 'Играть'" @click="player.toggle()">
          <IconPause v-if="isPlaying" class="h-7 w-7" />
          <IconPlay v-else class="h-7 w-7 translate-x-[1px]" />
        </button>

        <button type="button" class="rounded-btn p-2 text-fg-muted transition hover:text-fg" aria-label="Следующий трек"
          @click="player.next()">
          <IconNext class="h-6 w-6" />
        </button>

        <button type="button" class="relative rounded-btn p-2 transition"
          :class="repeatMode !== 'off' ? 'text-active' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="repeatMode !== 'off'" :aria-label="`Повтор: ${repeatMode}`" @click="player.cycleRepeat()">
          <IconRepeat class="h-5 w-5" />
          <span v-if="repeatMode === 'one'" class="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold">
            1
          </span>
        </button>
      </div>

      <!-- Правая часть: queue | mute + volume -->
      <div class="flex items-center justify-end gap-1 pr-6">
        <RouterLink :to="{ name: 'queue' }" class="rounded-btn p-2 text-fg-muted transition hover:text-fg"
          aria-label="Очередь">
          <IconList class="h-5 w-5" />
        </RouterLink>

        <!-- Mute + вертикальный слайдер на hover -->
        <div class="group/vol relative flex items-center">
          <button type="button" class="rounded-btn p-2 text-fg-muted transition hover:text-fg"
            :aria-label="muted ? 'Включить звук' : 'Выключить звук'" @click="player.toggleMute()">
            <IconVolumeMute v-if="muted || volume === 0" class="h-5 w-5" />
            <IconVolume v-else class="h-5 w-5" />
          </button>

          <div
            class="pointer-events-none absolute bottom-full left-1/2 z-10 flex h-32 w-6 -translate-x-1/2 items-center justify-center opacity-0 transition-opacity group-hover/vol:pointer-events-auto group-hover/vol:opacity-100">
            <input type="range" min="0" max="1" step="0.01" :value="muted ? 0 : volume" aria-label="Громкость"
              class="volume-slider h-1 w-32 cursor-pointer appearance-none rounded-full" :style="{
                background: `linear-gradient(to right, var(--color-fg) 0%, var(--color-fg) ${volumePercent}%, var(--color-hover-bg) ${volumePercent}%, var(--color-hover-bg) 100%)`,
              }" @input="onVolumeInput" />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.volume-slider {
  transform: rotate(-90deg);
  transform-origin: center;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: var(--color-accent);
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 9999px;
  background: var(--color-accent);
  cursor: pointer;
}
</style>
