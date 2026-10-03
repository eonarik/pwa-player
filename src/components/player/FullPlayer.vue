<!-- src/components/player/FullPlayer.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useDominantColor } from '@/composables/useDominantColor'
import { rgbToString } from '@/utils/dominantColor'
import PlayerProgressBar from './PlayerProgressBar.vue'
import DislikeButton from '@/components/ui/DislikeButton.vue'
import FavoriteButton from '@/components/ui/FavoriteButton.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import IconNext from '@/components/icons/IconNext.vue'
import IconPrev from '@/components/icons/IconPrev.vue'
import IconShuffle from '@/components/icons/IconShuffle.vue'
import IconRepeat from '@/components/icons/IconRepeat.vue'
import IconVolume from '@/components/icons/IconVolume.vue'
import IconVolumeMute from '@/components/icons/IconVolumeMute.vue'
import IconList from '@/components/icons/IconList.vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'

defineProps<{
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
    <div
      ref="rootRef"
      class="fixed inset-0 z-[140] flex flex-col bg-bg text-fg"
      :style="rootStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- Хедер -->
      <header class="app-safe-top flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
          aria-label="Назад"
          @click="emit('close')"
        >
          <IconArrowLeft class="h-6 w-6" />
        </button>

        <h2 class="flex-1 truncate text-center text-base font-medium text-fg">
          {{ title }}
        </h2>

        <div class="w-10" aria-hidden="true" />
      </header>

      <!-- Контент -->
      <div class="flex min-h-0 flex-1 flex-col items-center px-6 pb-8">
        <!-- Обложка + свечение -->
        <div class="flex w-full max-w-sm flex-1 items-center justify-center py-4">
          <div class="relative">
            <div
              v-if="currentTrack?.coverUrl"
              class="glow-pulse pointer-events-none absolute inset-0 -z-10"
              :style="glowStyle"
              aria-hidden="true"
            />

            <div
              class="aspect-square w-full max-w-[min(80vw,380px)] overflow-hidden rounded-card bg-bg-elevated shadow-2xl"
            >
              <img
                v-if="currentTrack?.coverUrl"
                :src="currentTrack.coverUrl"
                :alt="currentTrack.album"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full items-center justify-center">
                <IconPlaylist class="h-1/2 w-1/2 text-fg-subtle" />
              </div>
            </div>
          </div>
        </div>

        <!-- Title + artist + eye-off + heart -->
        <div class="relative w-full max-w-sm pb-6">
          <div class="min-w-0 px-12 text-center">
            <p class="truncate text-xl font-medium text-fg">
              {{ currentTrack?.title ?? 'Ничего не играет' }}
            </p>
            <p class="mt-1 truncate text-sm text-fg-muted">
              {{ currentTrack?.artist ?? '—' }}
            </p>
          </div>

          <!-- Дизлайк — слева -->
          <div class="absolute left-0 -top-1 flex items-start">
            <DislikeButton :track="currentTrack" size="lg" mode="skip" />
          </div>

          <!-- Избранное — справа -->
          <div class="absolute right-0 -top-1 flex items-start">
            <FavoriteButton :track="currentTrack" size="lg" />
          </div>
        </div>

        <!-- Volume + shuffle + repeat + queue -->
        <div class="flex w-full max-w-sm items-center justify-between pb-8">
          <button
            type="button"
            class="rounded-btn p-2 transition"
            :class="
              muted || volume === 0
                ? 'text-fg hover:bg-hover-bg'
                : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
            "
            :aria-label="muted ? 'Включить звук' : 'Выключить звук'"
            @click="player.toggleMute()"
          >
            <IconVolumeMute v-if="muted || volume === 0" class="h-6 w-6" />
            <IconVolume v-else class="h-6 w-6" />
          </button>

          <div class="flex items-center gap-4">
            <button
              type="button"
              class="rounded-btn p-2 transition"
              :class="shuffle ? 'text-fg' : 'text-fg-muted hover:text-fg'"
              :aria-pressed="shuffle"
              aria-label="Перемешать"
              @click="player.toggleShuffle()"
            >
              <IconShuffle class="h-6 w-6" />
            </button>

            <button
              type="button"
              class="relative rounded-btn p-2 transition"
              :class="repeatMode !== 'off' ? 'text-fg' : 'text-fg-muted hover:text-fg'"
              :aria-pressed="repeatMode !== 'off'"
              :aria-label="`Повтор: ${repeatMode}`"
              @click="player.cycleRepeat()"
            >
              <IconRepeat class="h-6 w-6" />
              <span
                v-if="repeatMode === 'one'"
                class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold"
              >
                1
              </span>
            </button>

            <RouterLink
              :to="{ name: 'queue' }"
              class="rounded-btn p-2 text-fg-muted transition hover:text-fg"
              aria-label="Очередь"
              @click="emit('close')"
            >
              <IconList class="h-6 w-6" />
            </RouterLink>
          </div>
        </div>

        <!-- Прогресс -->
        <div class="w-full max-w-sm pb-8">
          <PlayerProgressBar
            :current-time="currentTime"
            :duration="duration"
            size="lg"
            :show-time="true"
            @seek="onSeek"
          />
        </div>

        <!-- Транспорт -->
        <div class="flex w-full max-w-sm items-center justify-center gap-6">
          <button
            type="button"
            class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
            aria-label="Предыдущий трек"
            @click="player.prev()"
          >
            <IconPrev class="h-8 w-8" />
          </button>

          <button
            type="button"
            class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
            :aria-label="isPlaying ? 'Пауза' : 'Играть'"
            @click="player.toggle()"
          >
            <IconPause v-if="isPlaying" class="h-8 w-8" />
            <IconPlay v-else class="h-8 w-8 translate-x-[1px]" />
          </button>

          <button
            type="button"
            class="rounded-btn p-2 text-fg transition hover:bg-hover-bg"
            aria-label="Следующий трек"
            @click="player.next()"
          >
            <IconNext class="h-8 w-8" />
          </button>
        </div>
      </div>
    </div>
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
