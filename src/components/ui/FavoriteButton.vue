<!-- src/components/ui/FavoriteButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import IconHeart from '@/components/icons/IconHeart.vue'
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

const iconClass = computed(() => {
  if (props.size === 'sm') return 'h-4 w-4'
  if (props.size === 'lg') return 'h-6 w-6'
  return 'h-5 w-5'
})

const btnClass = computed(() => {
  if (props.size === 'sm') return 'p-1.5'
  return 'p-2'
})

function onClick() {
  const track = props.track
  if (!track) return
  playlists.toggleFavorite(track)
}
</script>

<template>
  <button type="button" class="rounded-btn transition" :class="[
    btnClass,
    isFavorite
      ? 'text-active hover:bg-hover-bg'
      : 'text-fg-subtle hover:bg-hover-bg hover:text-fg',
  ]" :aria-label="isFavorite ? 'Убрать из избранного' : 'В избранное'" @click.stop="onClick">
    <IconHeart :filled="isFavorite" :class="iconClass" />
  </button>
</template>
