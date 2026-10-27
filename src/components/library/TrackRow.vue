<!-- src/components/library/TrackRow.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import ListRow from '@/components/ui/ListRow.vue'
import PlayingIndicator from '@/components/ui/PlayingIndicator.vue'
import TrackCover from '@/components/ui/TrackCover.vue'
import Spinner from '@/components/ui/Spinner.vue'
import { useDislikesStore } from '@/stores/dislikes'
import { useTrackDisplay } from '@/composables/useTrackDisplay'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { isLocalTrack, isTrackUnavailable } from '@/services/library/selectors'
import { formatDuration } from '@/utils/formatDuration'
import { isLiveStream, isStreamingPlugin } from '@/plugins/registry'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'

const props = withDefaults(
  defineProps<{
    track: Track | LibraryTrack
    index: number
    isCurrent: boolean
    isPlaying: boolean
    showDownload?: boolean
  }>(),
  { showDownload: false },
)

const emit = defineEmits<{
  (e: 'select'): void
}>()

const dislikes = useDislikesStore()

const isLive = computed(() => isLiveStream(props.track.pluginId))
const isStreaming = computed(() => isStreamingPlugin(props.track.pluginId))
const isDisliked = computed(() => dislikes.isDisliked(props.track.id))

const { showSource, hasArtist, title, subtitle, hasSubtitle } = useTrackDisplay(
  computed(() => props.track),
)

const isDownloading = computed(() => downloadOrchestrator.isDownloading(props.track.id))

const downloadProgress = computed<number | null>(() => {
  if (!props.showDownload || isLive.value || isStreaming.value) return null
  if (!isDownloading.value) return null
  const p = downloadOrchestrator.getProgress(props.track.id)
  if (!p || p.total <= 0) return 0
  return Math.min(1, p.written / p.total)
})

const isLocal = computed(() => {
  if (!props.showDownload || isLive.value || isStreaming.value) return false
  return isLocalTrack(props.track as LibraryTrack)
})

const isUnavailable = computed(() => isTrackUnavailable(props.track))

const isBroken = computed(() => {
  if ('fileLocation' in props.track && props.track.fileLocation === 'nowhere') return true
  return false
})
</script>

<template>
  <ListRow :active="isCurrent" :disliked="isDisliked" :download-progress="downloadProgress" :downloaded="isLocal"
    @click="emit('select')">

    <template #leading>
      <div class="relative">
        <TrackCover :track="track" :class="isUnavailable ? 'opacity-50 grayscale' : ''">
          <PlayingIndicator v-if="isCurrent && isPlaying" />
        </TrackCover>

        <!-- Лоадер при скачивании поверх обложки -->
        <div v-if="isDownloading"
          class="absolute inset-0 z-10 flex items-center justify-center bg-bg/60 rounded-btn backdrop-blur-sm">
          <Spinner size="sm" />
        </div>
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium" :class="isUnavailable ? 'line-through text-fg-muted' : ''">
        <template v-if="showSource && hasArtist">
          <RouterLink :to="{ name: 'artist', params: { artistName: track.artist } }"
            class="transition hover:text-active" :class="isUnavailable ? 'pointer-events-none' : ''" @click.stop>
            {{ track.artist }}
          </RouterLink>
          <span> — </span>
        </template>
        <span>{{ title }}</span>
        <span v-if="isCurrent && !isPlaying" class="ml-1 text-xs text-active/70">(пауза)</span>
      </p>
    </template>

    <template #subtitle>
      <!-- Явная пометка битого файла -->
      <p v-if="isBroken" class="truncate text-[10px] text-red-400">
        Файл удален или поврежден
      </p>
      <p v-else-if="isUnavailable" class="truncate text-[10px] text-fg-subtle">
        Источник недоступен
      </p>
      <p v-else-if="!showSource && hasArtist" class="truncate text-xs text-fg-muted">
        <RouterLink :to="{ name: 'artist', params: { artistName: track.artist } }" class="transition hover:text-active"
          @click.stop>
          {{ track.artist }}
        </RouterLink>
      </p>
      <p v-else-if="hasSubtitle" class="truncate text-xs text-fg-muted">{{ subtitle }}</p>
    </template>

    <template #meta>
      <div class="flex shrink-0 items-center gap-2">
        <span v-if="isLive"
          class="rounded bg-active/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-active">
          Live
        </span>
        <span v-else-if="isStreaming"
          class="rounded bg-active/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-active">
          Stream
        </span>
        <span v-if="!isLive" class="text-xs tabular-nums text-fg-muted">
          {{ formatDuration(track.duration) }}
        </span>
      </div>
    </template>

    <template #trailing>
      <slot name="actions" />
    </template>
  </ListRow>
</template>
