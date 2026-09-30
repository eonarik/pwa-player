<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import TrackOriginButton from './TrackOriginButton.vue'
import { useDislikesStore } from '@/stores/dislikes'
import { useTrackDisplay } from '@/composables/useTrackDisplay'
import { formatDuration } from '@/utils/formatDuration'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: Track
  index: number
  isCurrent: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const dislikes = useDislikesStore()

const isDisliked = computed(() => dislikes.isDisliked(props.track.id))

const { title, subtitle, hasSubtitle } = useTrackDisplay(computed(() => props.track))

const showOriginButton = computed(() => {
  if (!('pluginId' in props.track)) return false
  if (props.track.pluginId === 'local') return false
  return true
})

const libraryTrack = computed(() => props.track as LibraryTrack)
</script>

<template>
  <ListRow :active="isCurrent" :disliked="isDisliked" @click="emit('select', index)">
    <template #leading>
      <div class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
        <img v-if="track.coverUrl" :src="track.coverUrl" :alt="track.album" class="h-full w-full object-cover"
          loading="lazy" />
        <span v-else class="text-xs font-medium text-fg-muted">{{ index + 1 }}</span>

        <PlayingIndicator v-if="isCurrent && isPlaying" />
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium">{{ title }}</p>
    </template>

    <template #subtitle>
      <p v-if="hasSubtitle" class="truncate text-xs text-fg-muted" :title="subtitle">{{ subtitle }}</p>
    </template>

    <template #meta>
      <span class="shrink-0 text-xs tabular-nums text-fg-muted transition-opacity"
        :class="showOriginButton || $slots.actions ? 'group-hover:opacity-0' : ''">
        {{ formatDuration(track.duration) }}
      </span>
    </template>

    <template #trailing>
      <TrackOriginButton v-if="showOriginButton" :track="libraryTrack" />
      <slot name="actions" />
    </template>
  </ListRow>
</template>
