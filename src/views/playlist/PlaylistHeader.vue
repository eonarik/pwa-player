<!-- src/views/playlist/PlaylistHeader.vue -->
<script setup lang="ts">
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue'
import PlaylistShareMenu from '@/components/playlists/PlaylistShareMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track'

const props = defineProps<{
  playlist: Playlist
  isFavorites: boolean
  resolvedTracks: Track[]
  unavailableCount: number
}>()

const emit = defineEmits<{
  (e: 'rename', value: string): void
  (e: 'delete'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <BatchDownloadButton :tracks="resolvedTracks as any" />
    <PlaylistShareMenu :playlist="playlist" />
    <IconButton v-if="!isFavorites" icon="trash" variant="danger" label="Удалить плейлист" @click="emit('delete')" />
  </div>
</template>
