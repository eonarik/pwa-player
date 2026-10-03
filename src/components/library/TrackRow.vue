<!-- src/components/library/TrackRow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import TrackCover from '@/components/ui/TrackCover.vue'
import { useDislikesStore } from '@/stores/dislikes'
import { useTrackDisplay } from '@/composables/useTrackDisplay'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { formatDuration } from '@/utils/formatDuration'
import type { Track } from '@/types/track'
import type { LibraryTrack, TrackOrigin } from '@/types/library'

const props = withDefaults(
  defineProps<{
    track: Track | LibraryTrack
    index: number
    isCurrent: boolean
    isPlaying: boolean
    /** Показывать ли полоску прогресса скачивания */
    showDownload?: boolean
  }>(),
  { showDownload: false },
)

const emit = defineEmits<{
  (e: 'select'): void
}>()

const dislikes = useDislikesStore()

const isDisliked = computed(() => dislikes.isDisliked(props.track.id))

const { showSource, hasArtist, title, subtitle, hasSubtitle } = useTrackDisplay(
  computed(() => props.track),
)

const isDownloading = computed(() => downloadOrchestrator.isDownloading(props.track.id))

const downloadProgress = computed<number | null>(() => {
  if (!props.showDownload) return null
  if (!isDownloading.value) return null
  const p = downloadOrchestrator.getProgress(props.track.id)
  if (!p || p.total <= 0) return 0
  return Math.min(1, p.written / p.total)
})

function trackOrigin(t: Track | LibraryTrack): TrackOrigin | undefined {
  return 'origin' in t ? (t as LibraryTrack).origin : undefined
}

const isDownloaded = computed(() => {
  if (!props.showDownload) return false
  return trackOrigin(props.track) === 'downloaded'
})
</script>

<template>
  <ListRow :active="isCurrent" :disliked="isDisliked" :download-progress="downloadProgress" :downloaded="isDownloaded"
    @click="emit('select')">
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
        <span v-if="isCurrent && !isPlaying" class="ml-1 text-xs text-active/70">(пауза)</span>
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
      <span class="shrink-0 text-xs tabular-nums text-fg-muted">
        {{ formatDuration(track.duration) }}
      </span>
    </template>

    <template #trailing>
      <slot name="actions" />
    </template>
  </ListRow>
</template>
