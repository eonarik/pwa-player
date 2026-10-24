<!-- src/components/library/BatchDownloadButton.vue -->
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useBatchDownload } from '@/composables/useBatchDownload'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  tracks: LibraryTrack[]
}>()

const tracksRef = toRef(props, 'tracks')

const { isDownloading, progress, hasDownloadable, pendingCount, download, cancel } =
  useBatchDownload(tracksRef)

const label = computed(() => {
  if (isDownloading.value) {
    const p = progress.value
    return p ? `${p.done}/${p.total} · Отменить` : 'Отмена'
  }
  if (pendingCount.value === 0) return 'Скачано'
  return 'Скачать'
})

const variant = computed(() => {
  if (isDownloading.value) return 'danger'
  if (pendingCount.value === 0) return 'secondary'
  return 'primary'
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
  <Button v-if="hasDownloadable" :variant="variant" size="sm" :disabled="pendingCount === 0 && !isDownloading"
    @click="onClick">
    <Icon v-if="pendingCount === 0 && !isDownloading" name="check" w="w-3.5" h="h-3.5" />
    <Icon v-else name="download" w="w-3.5" h="h-3.5" />
    {{ label }}
  </Button>
</template>
