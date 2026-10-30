<!-- src/components/ui/DislikeButton.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useDislikesStore } from '@/stores/dislikes';
import { usePlayerStore } from '@/stores/player';
import IconButton from './IconButton.vue';
import type { Track } from '@/types/track';

const props = withDefaults(
  defineProps<{
    track: Track | null | undefined;
    size?: 'sm' | 'md' | 'lg';
    mode?: 'toggle' | 'skip';
  }>(),
  { size: 'md', mode: 'toggle' },
);

const dislikes = useDislikesStore();
const player = usePlayerStore();

const isDisliked = computed(() => {
  const id = props.track?.id;
  return id ? dislikes.isDisliked(id) : false;
});

function onClick() {
  const track = props.track;
  if (!track) return;

  if (isDisliked.value) {
    dislikes.undislike(track.id);
    return;
  }

  dislikes.dislike(track);
  if (props.mode === 'skip') {
    player.next();
  }
}
</script>

<template>
  <IconButton
    icon="eye-off"
    variant="ghost"
    :size="size"
    :label="isDisliked ? 'Показывать при воспроизведении' : 'Скрывать при воспроизведении'"
    :class="isDisliked ? 'text-red-400' : ''"
    @click.stop="onClick"
  />
</template>
