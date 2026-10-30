<!-- src/components/ui/FavoriteButton.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { usePlaylistsStore } from '@/stores/playlists';
import IconButton from './IconButton.vue';
import type { Track } from '@/types/track';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    track: Track | null | undefined;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  { size: 'md' },
);

const playlists = usePlaylistsStore();

const isFavorite = computed(() => {
  const id = props.track?.id;
  return id ? playlists.isFavorite(id) : false;
});

function onClick() {
  const track = props.track;
  if (!track) return;
  playlists.toggleFavorite(track);
}
</script>

<template>
  <IconButton
    variant="ghost"
    :size="size"
    :label="isFavorite ? 'Убрать из избранного' : 'В избранное'"
    :class="isFavorite ? 'text-active' : ''"
    @click.stop="onClick"
  >
    <Icon name="heart" :w="'w-3.5'" :h="'h-3.5'" :filled="isFavorite" />
  </IconButton>
</template>
