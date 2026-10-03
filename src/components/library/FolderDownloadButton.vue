<!-- src/components/library/FolderDownloadButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useBatchDownload } from '@/composables/useBatchDownload'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconDownload from '@/components/icons/IconDownload.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  folderId: string
}>()

const library = useLibraryStore()

const tracks = computed<LibraryTrack[]>(() =>
  library.getAllTracksInFolderRecursive(props.folderId),
)

const { isDownloading, progress, pendingCount, download, cancel } = useBatchDownload(tracks)

const label = computed(() => {
  if (isDownloading.value) {
    const p = progress.value
    return p ? `${p.done}/${p.total} · Отменить` : 'Отмена'
  }
  if (pendingCount.value === 0) return 'Скачано'
  return `Скачать (${pendingCount.value})`
})

function onClick() {
  if (isDownloading.value) {
    cancel()
    return
  }
  if (pendingCount.value === 0) return
  void download()
}
</script>

<template>
  <button v-if="tracks.length > 0" type="button"
    class="flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
    :class="isDownloading
        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-red-500/15 hover:text-red-400'
        : pendingCount === 0
          ? 'bg-card-bg text-fg-muted'
          : 'bg-card-bg text-fg hover:bg-hover-bg'
      " :disabled="pendingCount === 0 && !isDownloading" @click="onClick">
    <IconCheck v-if="pendingCount === 0 && !isDownloading" class="h-3.5 w-3.5" />
    <IconDownload v-else class="h-3.5 w-3.5" />
    {{ label }}
  </button>
</template>
