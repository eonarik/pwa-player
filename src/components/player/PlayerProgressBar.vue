<!-- src/components/player/PlayerProgressBar.vue -->
<script setup lang="ts">
import { formatDuration } from "@/utils/formatDuration";
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    currentTime: number
    duration: number
    /** sm — мини-плеер (thumb на hover), lg — FullPlayer (thumb всегда виден) */
    size?: 'sm' | 'lg'
    /** Если false — прогресс не интерактивен, клики уходят наверх */
    interactive?: boolean
    /** Показывать плашки времени всегда (FullPlayer) */
    showTime?: boolean
    /** Показывать плашки времени при hover (десктоп-мини) */
    showTimeOnHover?: boolean
    /** Расти до lg при hover */
    expandOnHover?: boolean
    /**
     * Где показывать displayTime:
     * - 'floating' — над текущей позицией (мини-плеер)
     * - 'fixed' — слева у края (FullPlayer)
     */
    timePosition?: 'fixed' | 'floating'
  }>(),
  {
    size: 'sm',
    interactive: true,
    showTime: false,
    showTimeOnHover: false,
    expandOnHover: false,
    timePosition: 'floating',
  },
)

const emit = defineEmits<{
  (e: 'seek', time: number): void
}>()

const isDragging = ref(false)
const dragValue = ref(0)
const isHovered = ref(false)

const displayTime = computed(() => (isDragging.value ? dragValue.value : props.currentTime))

const progressPercent = computed(() => {
  if (!props.duration) return 0
  return Math.min(100, (displayTime.value / props.duration) * 100)
})

const ariaValue = computed(() => {
  if (!props.duration) return 0
  return Math.round((displayTime.value / props.duration) * 100)
})

const effectiveSize = computed<'sm' | 'lg'>(() => {
  if (props.size === 'lg') return 'lg'
  if (props.expandOnHover && isHovered.value) return 'lg'
  return 'sm'
})

const isLarge = computed(() => effectiveSize.value === 'lg')

const showTimeMarks = computed(() => props.showTime || (props.showTimeOnHover && isHovered.value))

function onInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  dragValue.value = value
}

function onPointerDown(e: PointerEvent) {
  const target = e.currentTarget as HTMLInputElement
  target.setPointerCapture(e.pointerId)
  isDragging.value = true
  dragValue.value = props.currentTime
}

function onPointerUp(e: PointerEvent) {
  const target = e.currentTarget as HTMLInputElement
  if (target.hasPointerCapture(e.pointerId)) {
    target.releasePointerCapture(e.pointerId)
  }
  if (isDragging.value) {
    emit('seek', dragValue.value)
  }
  isDragging.value = false
}

function onMouseEnter() {
  isHovered.value = true
}

function onMouseLeave() {
  isHovered.value = false
}
</script>

<template>
  <div class="group relative w-full" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <!-- Плашки времени -->
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0"
      enter-to-class="opacity-100" leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div v-if="showTimeMarks" class="pointer-events-none absolute inset-x-0 -top-6 h-5">
        <!-- displayTime: floating — над текущей позицией; fixed — слева -->
        <span class="absolute text-xs tabular-nums text-fg-muted" :class="timePosition === 'fixed' ? 'left-0' : ''"
          :style="timePosition === 'fixed'
            ? undefined
            : {
              left: `clamp(24px, ${progressPercent}%, calc(100% - 60px))`,
              transform: 'translateX(-50%)',
            }
            ">
          {{ formatDuration(displayTime) }}
        </span>

        <!-- duration: всегда справа -->
        <span class="absolute right-0 text-xs tabular-nums text-fg-muted">
          {{ formatDuration(duration) }}
        </span>
      </div>
    </Transition>

    <!-- Дорожка -->
    <div class="w-full overflow-hidden rounded-full transition-[height] duration-150" :class="isLarge ? 'h-1.5' : 'h-1'"
      :style="{ backgroundColor: 'var(--color-hover-bg)' }">
      <div class="h-full bg-fg transition-[width] duration-75" :style="{ width: `${progressPercent}%` }" />
    </div>

    <!-- Range поверх дорожки -->
    <input v-if="interactive" type="range" min="0" :max="duration || 0" step="0.1" :value="displayTime"
      :aria-valuenow="ariaValue" aria-label="Позиция воспроизведения"
      class="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent" :class="isLarge
        ? '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg'
        : '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:transition-opacity group-hover:[&::-webkit-slider-thumb]:opacity-100 group-focus-within:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-fg [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:transition-opacity group-hover:[&::-moz-range-thumb]:opacity-100 group-focus-within:[&::-moz-range-thumb]:opacity-100'
        " @input="onInput" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="onPointerUp" />
  </div>
</template>
