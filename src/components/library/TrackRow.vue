<!-- src/components/library/TrackRow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import TrackCover from '@/components/ui/TrackCover.vue'
import { useDislikesStore } from '@/stores/dislikes'
import { useDownloadOrchestrator } from '@/composables/useDownloadOrchestrator'
import { useTrackDisplay } from '@/composables/useTrackDisplay'
import { formatDuration } from '@/utils/formatDuration'
import type { Track } from '@/types/track'
import { downloadOrchestrator } from "@/services/download/DownloadOrchestrator"

const props = withDefaults(
  defineProps<{
    track: Track
    index: number
    isCurrent: boolean
    isPlaying: boolean
    /** Показывать ли синюю полоску скачивания */
    showDownload?: boolean
  }>(),
  { showDownload: false },
)

const emit = defineEmits<{
  (e: 'select'): void
}>()

const dislikes = useDislikesStore()
const orchestrator = useDownloadOrchestrator()

const isDisliked = computed(() => dislikes.isDisliked(props.track.id))

const { showSource, hasArtist, title, subtitle, hasSubtitle } = useTrackDisplay(
  computed(() => props.track),
)

const isDownloading = computed(() => downloadOrchestrator.isDownloading(props.track.id))
const downloadProgress = computed<number | null>(() => {
  if (!props.showDownload) return null
  if (!isDownloading.value) return null
  const p = orchestrator.getProgress(props.track.id)
  if (!p || p.total <= 0) return 0
  return Math.min(1, p.written / p.total)
})

const isDownloaded = computed(() => {
  if (!props.showDownload) return false
  return props.track.origin === 'downloaded'
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
