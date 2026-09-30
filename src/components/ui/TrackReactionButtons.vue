<!-- src/components/ui/TrackReactionButtons.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTrackReaction } from '@/composables/useTrackReaction'
import IconEyeOff from '@/components/icons/IconEyeOff.vue'
import IconHeart from '@/components/icons/IconHeart.vue'
import type { Track } from '@/types/track'

const props = withDefaults(
  defineProps<{
    track: Track | null | undefined
    size?: 'sm' | 'md' | 'lg'
    /** 'toggle' — без next(), 'skip' — с next() */
    dislikeMode?: 'toggle' | 'skip'
  }>(),
  { size: 'md', dislikeMode: 'toggle' },
)

const trackRef = computed(() => props.track)

const { isFavorite, isDisliked, toggleFavorite, toggleDislike } = useTrackReaction(trackRef)

const iconClass = computed(() => {
  if (props.size === 'sm') return 'h-4 w-4'
  if (props.size === 'lg') return 'h-6 w-6'
  return 'h-5 w-5'
})

const btnClass = computed(() => {
  if (props.size === 'sm') return 'p-1.5'
  return 'p-2'
})
</script>

<template>
  <div class="flex items-center gap-0.5">
    <!-- Дизлайк (скрыть) -->
    <button type="button" class="rounded-btn transition" :class="[
      btnClass,
      isDisliked
        ? 'text-red-400 hover:bg-hover-bg'
        : 'text-fg-subtle hover:bg-hover-bg hover:text-fg',
    ]" :aria-label="isDisliked ? 'Показывать при воспроизведении' : 'Скрывать при воспроизведении'"
      @click.stop="toggleDislike(dislikeMode)">
      <IconEyeOff :class="iconClass" />
    </button>

    <!-- Избранное -->
    <button type="button" class="rounded-btn transition" :class="[
      btnClass,
      isFavorite
        ? 'text-active hover:bg-hover-bg'
        : 'text-fg-subtle hover:bg-hover-bg hover:text-fg',
    ]" :aria-label="isFavorite ? 'Убрать из избранного' : 'В избранное'" @click.stop="toggleFavorite">
      <IconHeart :filled="isFavorite" :class="iconClass" />
    </button>
  </div>
</template>
