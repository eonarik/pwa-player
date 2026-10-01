<!-- src/components/library/TrackListItem.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import TrackCover from '@/components/ui/TrackCover.vue'
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

const { showSource, hasArtist, title, subtitle, hasSubtitle } = useTrackDisplay(
  computed(() => props.track),
)

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
      <TrackCover :track="track">
        <PlayingIndicator v-if="isCurrent && isPlaying" />
      </TrackCover>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium">
        <template v-if="showSource && hasArtist">
          <RouterLink :to="{ name: 'artist', params: { artistName: track.artist } }"
            class="transition hover:text-active" @click.stop>
            {{ track.artist }}
          </RouterLink>
          <span> — </span>
        </template>
        <span>{{ title }}</span>
      </p>
    </template>

    <template #subtitle>
      <p v-if="!showSource && hasArtist" class="truncate text-xs text-fg-muted">
        <RouterLink :to="{ name: 'artist', params: { artistName: track.artist } }" class="transition hover:text-active"
          @click.stop>
          {{ track.artist }}
        </RouterLink>
      </p>
      <p v-else-if="hasSubtitle" class="truncate text-xs text-fg-muted">{{ subtitle }}</p>
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
