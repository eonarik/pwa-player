<!-- src/components/player/ProgressBar.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  currentTime: number
  duration: number
}>()

const emit = defineEmits<{
  (e: 'seek', time: number): void
}>()

// Локальное состояние, пока пользователь тащит
const isDragging = ref(false)
const dragValue = ref(0)

// Что показывать: значение drag'а, если тащим, иначе — реальное время
const displayTime = computed(() => (isDragging.value ? dragValue.value : props.currentTime))

const progressPercent = computed(() => {
  if (!props.duration) return 0
  return (displayTime.value / props.duration) * 100
})

const ariaValue = computed(() => {
  if (!props.duration) return 0
  return Math.round((displayTime.value / props.duration) * 100)
})

function onInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  dragValue.value = value
}

function onPointerDown() {
  isDragging.value = true
  dragValue.value = props.currentTime
}

function onPointerUp() {
  if (isDragging.value) {
    emit('seek', dragValue.value)
  }
  isDragging.value = false
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex w-full items-center gap-3">
    <span class="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">
      {{ formatTime(displayTime) }}
    </span>

    <div class="group relative flex-1">
      <!-- Фоновая дорожка -->
      <div class="pointer-events-none absolute inset-y-0 flex w-full items-center">
        <div class="h-1 w-full overflow-hidden rounded-full bg-zinc-700">
          <div
            class="h-full bg-emerald-500 transition-[width] duration-75"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <!-- Нативный range поверх — невидимый, но ловит все события -->
      <input
        type="range"
        min="0"
        :max="duration || 0"
        step="0.1"
        :value="displayTime"
        :aria-valuenow="ariaValue"
        aria-label="Позиция воспроизведения"
        class="relative h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:transition-opacity group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-emerald-400 [&::-moz-range-thumb]:opacity-0 group-hover:[&::-moz-range-thumb]:opacity-100"
        @input="onInput"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>

    <span class="w-10 shrink-0 text-xs tabular-nums text-zinc-500">
      {{ formatTime(duration) }}
    </span>
  </div>
</template>
