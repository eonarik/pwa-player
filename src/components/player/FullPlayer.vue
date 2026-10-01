<!-- src/components/player/FullPlayer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useDominantColor } from '@/composables/useDominantColor'
import { rgbToString } from '@/utils/dominantColor'
import PlayerProgressBar from './PlayerProgressBar.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import IconNext from '@/components/icons/IconNext.vue'
import IconPrev from '@/components/icons/IconPrev.vue'
import IconShuffle from '@/components/icons/IconShuffle.vue'
import IconRepeat from '@/components/icons/IconRepeat.vue'
import IconVolumeMute from '@/components/icons/IconVolumeMute.vue'
import IconList from "../icons/IconList.vue"
import TrackReactionButtons from "../ui/TrackReactionButtons.vue"

const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const player = usePlayerStore()

const { currentTrack, isPlaying, currentTime, duration, repeatMode, shuffle, muted, volume } =
  storeToRefs(player)

// --- Доминирующий цвет обложки + пульсация ---------------------------

const coverSrc = computed(() => currentTrack.value?.coverUrl ?? null)
const dominantColor = useDominantColor(coverSrc)

const glowStyle = computed(() => {
  const c = dominantColor.value
  return {
    background: `radial-gradient(ellipse 50% 12% at 50% 80%, ${rgbToString(c, 0.7)} 0%, ${rgbToString(c, 0)} 70%)`,
  }
})

// --- Seek ------------------------------------------------------------

function onSeek(time: number) {
  player.seek(time)
}

// --- Свайп вниз с резинкой ------------------------------------------

const DRAG_THRESHOLD = 120
const DAMPING = 0.6

const rootRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const dragOffset = ref(0)
let startY = 0

function onPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return

  const target = e.target as HTMLElement
  if (target.closest('button, input, a, [role="button"]')) return

  startY = e.clientY
  isDragging.value = true
  dragOffset.value = 0

  rootRef.value?.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return

  const dy = e.clientY - startY
  if (dy <= 0) {
    dragOffset.value = 0
    return
  }
  dragOffset.value = dy * DAMPING
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return

  const target = e.currentTarget as HTMLElement
  if (target.hasPointerCapture(e.pointerId)) {
    target.releasePointerCapture(e.pointerId)
  }

  if (dragOffset.value >= DRAG_THRESHOLD) {
    dragOffset.value = window.innerHeight
    setTimeout(() => emit('close'), 200)
  } else {
    dragOffset.value = 0
  }

  isDragging.value = false
}

const rootStyle = computed(() => {
  if (!isDragging.value && dragOffset.value === 0) return {}
  return {
    transform: `translateY(${dragOffset.value}px)`,
    transition: isDragging.value ? 'none' : 'transform 200ms ease-out',
  }
})

// --- Закрытие при исчезновении трека ---------------------------------

watch(
  () => currentTrack.value?.id,
  (id) => {
    if (!id) emit('close')
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-4">
      <div ref="rootRef" class="fixed inset-0 z-[140] flex flex-col bg-bg text-fg" :style="rootStyle"
        @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp">
        <!-- Хедер -->
        <header class="app-safe-top flex shrink-0 items-center gap-2 px-3 py-2">
          <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg" aria-label="Назад"
            @click="emit('close')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-6">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 class="flex-1 truncate text-base font-medium text-fg">
            {{ title }}
          </h2>

          <div class="w-10" aria-hidden="true" />
        </header>

        <!-- Контент -->
        <div class="flex min-h-0 flex-1 flex-col items-center px-6 pb-8">
          <!-- Обложка + свечение -->
          <div class="flex w-full max-w-sm flex-1 items-center justify-center py-4">
            <div class="relative">
              <div v-if="currentTrack?.coverUrl" class="glow-pulse pointer-events-none absolute inset-0 -z-10"
                :style="glowStyle" aria-hidden="true" />
              <div class="aspect-square w-full max-w-[min(80vw,380px)] overflow-hidden bg-bg-elevated shadow-2xl">
                <img v-if="currentTrack?.coverUrl" :src="currentTrack.coverUrl" :alt="currentTrack.album"
                  class="h-full w-full object-cover" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
                    class="h-1/2 w-1/2 text-fg-subtle">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Title + artist (центр) + кнопки (сверху справа) -->
          <div class="relative w-full max-w-sm pb-6">
            <div class="min-w-0 px-12 text-center">
              <p class="truncate text-xl font-medium text-fg">
                {{ currentTrack?.title ?? 'Ничего не играет' }}
              </p>
              <p v-if="currentTrack?.artist" class="mt-1 truncate text-sm">
                <RouterLink :to="{ name: 'artist', params: { artistName: currentTrack.artist } }"
                  class="text-active/80 transition hover:text-active">
                  {{ currentTrack.artist }}
                </RouterLink>
              </p>
            </div>

            <div class="absolute right-0 top-0 flex items-start gap-1">
              <TrackReactionButtons :track="currentTrack" size="md" dislike-mode="skip" />
            </div>
          </div>

          <!-- Volume + repeat + shuffle -->
          <div class="flex w-full max-w-sm items-center justify-between pb-8">
            <button type="button" class="rounded-btn p-2 transition" :class="muted || volume === 0
              ? 'text-fg hover:bg-hover-bg'
              : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
              " :aria-label="muted ? 'Включить звук' : 'Выключить звук'" @click="player.toggleMute()">
              <IconVolumeMute v-if="muted || volume === 0" class="h-6 w-6" />
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-6">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            </button>

            <div class="flex items-center gap-4">
              <button type="button" class="rounded-btn p-2 transition"
                :class="shuffle ? 'text-active' : 'text-fg-muted hover:text-fg'" :aria-pressed="shuffle"
                aria-label="Перемешать" @click="player.toggleShuffle()">
                <IconShuffle class="h-6 w-6" />
              </button>

              <button type="button" class="relative rounded-btn p-2 transition"
                :class="repeatMode !== 'off' ? 'text-active' : 'text-fg-muted hover:text-fg'"
                :aria-pressed="repeatMode !== 'off'" :aria-label="`Повтор: ${repeatMode}`"
                @click="player.cycleRepeat()">
                <IconRepeat class="h-6 w-6" />
                <span v-if="repeatMode === 'one'"
                  class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold">
                  1
                </span>
              </button>

              <!-- Очередь -->
              <RouterLink :to="{ name: 'queue' }" @click="emit('close')" class="relative rounded-btn p-2 transition"
                aria-label="Очередь">
                <IconList class="h-6 w-6" />
              </RouterLink>
            </div>
          </div>

          <!-- Прогресс -->
          <div class="w-full max-w-sm pb-8">
            <PlayerProgressBar :current-time="currentTime" :duration="duration" size="lg" :show-time="true"
              time-position="fixed" @seek="onSeek" />
          </div>

          <!-- Транспорт -->
          <div class="flex w-full max-w-sm items-center justify-center gap-6">
            <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
              aria-label="Предыдущий трек" @click="player.prev()">
              <IconPrev class="h-8 w-8" />
            </button>

            <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
              :aria-label="isPlaying ? 'Пауза' : 'Играть'" @click="player.toggle()">
              <IconPause v-if="isPlaying" class="h-8 w-8" />
              <IconPlay v-else class="h-8 w-8 translate-x-[1px]" />
            </button>

            <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
              aria-label="Следующий трек" @click="player.next()">
              <IconNext class="h-8 w-8" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.glow-pulse {
  animation: glow-pulse 4s ease-in-out infinite;
}

@keyframes glow-pulse {

  0%,
  100% {
    opacity: 0.6;
    transform: scale(1.5) scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.5) scale(1.1);
  }
}
</style>
