<!-- src/components/ui/FavoriteButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import IconButton from './IconButton.vue'
import type { Track } from '@/types/track'

const props = withDefaults(
  defineProps<{
    track: Track | null | undefined
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const playlists = usePlaylistsStore()

const isFavorite = computed(() => {
  const id = props.track?.id
  return id ? playlists.isFavorite(id) : false
})

function onClick() {
  const track = props.track
  if (!track) return
  playlists.toggleFavorite(track)
}

// Для "сердечка" у нас есть два состояния: filled и outline.
// В реестре иконок у нас только `heart`. Если нужна заливка, можно сделать
// `heart-filled` в реестре, либо использовать CSS (fill: currentColor для filled).
const iconName = computed(() => isFavorite.value ? 'heart-filled' : 'heart')
</script>

<template>
  <IconButton :icon="iconName" variant="ghost" :size="size" :label="isFavorite ? 'Убрать из избранного' : 'В избранное'"
    :class="isFavorite ? '!text-active' : ''" @click.stop="onClick" />
</template>
