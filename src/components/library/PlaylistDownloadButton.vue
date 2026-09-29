<!-- src/components/library/PlaylistDownloadButton.vue -->
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useBatchDownload } from '@/composables/useBatchDownload'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  tracks: LibraryTrack[]
}>()

const tracksRef = toRef(props, 'tracks')

const { isDownloading, progress, pendingCount, download, cancel } =
  useBatchDownload(tracksRef)

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
      <template v-if="pendingCount === 0 && !isDownloading">
        <path d="M20 6L9 17l-5-5" />
      </template>
      <template v-else>
        <path d="M16 16l-4 4-4-4M12 20V10" />
        <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
      </template>
    </svg>
    {{ label }}
  </button>
</template>
