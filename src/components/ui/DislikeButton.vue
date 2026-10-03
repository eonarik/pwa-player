<!-- src/components/ui/DislikeButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useDislikesStore } from '@/stores/dislikes'
import { usePlayerStore } from '@/stores/player'
import IconEyeOff from '@/components/icons/IconEyeOff.vue'
import type { Track } from '@/types/track'

const props = withDefaults(
  defineProps<{
    track: Track | null | undefined
    size?: 'sm' | 'md' | 'lg'
    /**
     * 'toggle' — просто переключить (меню трека).
     * 'skip' — переключить и при постановке дизлайка перейти к следующему (плеер).
     */
    mode?: 'toggle' | 'skip'
  }>(),
  { size: 'md', mode: 'toggle' },
)

const dislikes = useDislikesStore()
const player = usePlayerStore()

const isDisliked = computed(() => {
  const id = props.track?.id
  return id ? dislikes.isDisliked(id) : false
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

  if (isDisliked.value) {
    dislikes.undislike(track.id)
    return
  }

  dislikes.dislike(track)
  if (props.mode === 'skip') {
    player.next()
  }
}
</script>

<template>
  <button type="button" class="rounded-btn transition" :class="[
    btnClass,
    isDisliked
      ? 'text-red-400 hover:bg-hover-bg'
      : 'text-fg-subtle hover:bg-hover-bg hover:text-fg',
  ]" :aria-label="isDisliked ? 'Показывать при воспроизведении' : 'Скрывать при воспроизведении'"
    @click.stop="onClick">
    <IconEyeOff :class="iconClass" />
  </button>
</template>
