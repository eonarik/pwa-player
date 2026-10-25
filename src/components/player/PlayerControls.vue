<!-- src/components/player/PlayerControls.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { isLinearContent, isLiveStream } from '@/plugins/registry'
import PlayerProgressBar from './PlayerProgressBar.vue'
import NowPlayingInfo from './NowPlayingInfo.vue'
import TrackReactionButtons from '../ui/TrackReactionButtons.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Icon from '@/components/ui/Icon.vue'

const emit = defineEmits<{
  (e: 'open'): void
}>()

const player = usePlayerStore()
const { currentTrack, isPlaying, currentTime, duration, volume, muted, repeatMode, shuffle } =
  storeToRefs(player)

const isLinear = computed(() => currentTrack.value ? isLinearContent(currentTrack.value.pluginId) : false)
const isLive = computed(() => currentTrack.value ? isLiveStream(currentTrack.value.pluginId) : false)

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

const volumePercent = computed(() => (muted.value ? 0 : Math.round(volume.value * 100)))

const muteLabel = computed(() => (muted.value ? 'Включить звук' : 'Выключить звук'))
const repeatLabel = computed(() => `Повтор: ${repeatMode.value}`)

function onSeek(time: number) {
  player.seek(time)
}

function onVolumeInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  if (value > 0 && muted.value) {
    player.toggleMute()
  }
  player.setVolume(value)
}
</script>

<template>
  <footer class="relative w-full bg-bg radio-grille-bg pb-[env(safe-area-inset-bottom)]">
    <!-- Прогресс -->
    <PlayerProgressBar v-if="!isLive" :current-time="currentTime" :duration="duration" size="sm"
      :interactive="!isCoarsePointer" :expand-on-hover="!isCoarsePointer" :show-time-on-hover="!isCoarsePointer"
      time-position="floating" @seek="onSeek" />
    <div v-else class="flex h-1 w-full items-center justify-center bg-active/20">
      <span class="text-[9px] font-bold uppercase tracking-widest text-active/80">Live</span>
    </div>
    <div class="absolute -top-1 z-[1] radio-scale w-full max-w-full"></div>

    <!-- === Мобильная версия === -->
    <div class="grid grid-cols-[1fr_auto] items-stretch md:hidden">
      <button type="button" data-player-open class="flex min-w-0 items-center pl-2 text-left"
        :aria-label="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'"
        v-tooltip="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'" @click="emit('open')">
        <NowPlayingInfo :track="currentTrack" cover-class="h-16 w-16" fallback-icon-class="h-6 w-6" />
      </button>

      <div class="flex items-center pr-2">
        <IconButton v-if="!isLive" icon="prev" variant="ghost" size="lg" label="Предыдущий трек"
          @click="player.prev()" />

        <button type="button" class="player-play-pause-btn rounded-full p-2 text-fg transition hover:text-fg-muted"
          :aria-label="isPlaying ? 'Пауза' : 'Играть'" v-tooltip="isPlaying ? 'Пауза' : 'Играть'"
          @click.stop="player.toggle()">
          <Icon name="pause" v-if="isPlaying" w="w-7" h="h-7" />
          <Icon name="play" v-else w="w-7" h="h-7" class="translate-x-[1px]" />
        </button>

        <IconButton v-if="!isLive" icon="next" variant="ghost" size="lg" label="Следующий трек"
          @click="player.next()" />
      </div>
    </div>

    <!-- === Десктопная версия === -->
    <div class="hidden w-full items-stretch md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" data-player-open class="flex min-w-0 items-center pr-4 text-left"
          :aria-label="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'"
          v-tooltip="currentTrack ? `Открыть плеер: ${currentTrack.title}` : 'Открыть плеер'" @click="emit('open')">
          <NowPlayingInfo :track="currentTrack" cover-class="h-16 w-16" fallback-icon-class="h-6 w-6" />
        </button>

        <TrackReactionButtons v-if="!isLive && !isLinear" :track="currentTrack" size="md" dislike-mode="skip" />
      </div>

      <div class="flex items-center justify-center gap-1">
        <IconButton v-if="!isLive && !isLinear" icon="shuffle" variant="ghost"
          :label="shuffle ? 'Не перемешивать' : 'Перемешать'" :class="shuffle ? 'text-active' : ''"
          @click="player.toggleShuffle()" />

        <IconButton v-if="!isLive" icon="prev" variant="ghost" size="lg" label="Предыдущий трек"
          @click="player.prev()" />

        <button type="button" class="player-play-pause-btn rounded-btn p-2 text-fg transition hover:text-fg-muted"
          :aria-label="isPlaying ? 'Пауза' : 'Играть'" v-tooltip="isPlaying ? 'Пауза' : 'Играть'"
          @click.stop="player.toggle()">
          <Icon name="pause" v-if="isPlaying" w="w-7" h="h-7" />
          <Icon name="play" v-else w="w-7" h="h-7" class="translate-x-[1px]" />
        </button>

        <IconButton v-if="!isLive" icon="next" variant="ghost" size="lg" label="Следующий трек"
          @click="player.next()" />

        <IconButton v-if="!isLive && !isLinear" icon="repeat" variant="ghost" :label="repeatLabel"
          :class="repeatMode !== 'off' ? 'text-active' : ''" @click="player.cycleRepeat()" />
      </div>

      <div class="flex items-center justify-end gap-1 pr-6">
        <IconButton icon="list" variant="ghost" :to="{ name: 'queue' }" label="Очередь" />

        <div class="group/vol relative flex items-center">
          <IconButton :icon="muted || volume === 0 ? 'volume-mute' : 'volume'" variant="ghost" :label="muteLabel"
            @click="player.toggleMute()" />

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
