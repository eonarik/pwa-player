<!-- src/components/library/TrackOriginButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTrackDownload } from '@/composables/useTrackDownload'
import IconDownload from '@/components/icons/IconDownload.vue'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconFolder from '@/components/icons/IconFolder.vue'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: LibraryTrack
}>()

const { isDownloading, progressRatio, download, cancel, remove } = useTrackDownload(
  computed(() => props.track),
)

const origin = computed(() => props.track.origin ?? 'remote')

const label = computed(() => {
  if (isDownloading.value) return 'Отменить скачивание'
  if (origin.value === 'downloaded') return 'Удалить с устройства'
  if (origin.value === 'only-local') return 'Удалить с устройства'
  return 'Скачать'
})

async function onClick() {
  if (isDownloading.value) {
    cancel()
    return
  }

  if (origin.value === 'remote') {
    await download()
    return
  }

  if (origin.value === 'only-local') {
    const confirmed = window.confirm('Удалить трек с устройства?')
    if (!confirmed) return
    await remove()
    return
  }

  await remove()
}
</script>

<template>
  <button type="button" class="group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-btn transition"
    :class="isDownloading
        ? 'text-emerald-400'
        : origin === 'downloaded'
          ? 'text-emerald-500 hover:bg-red-500/10 hover:text-red-400'
          : origin === 'only-local'
            ? 'text-amber-500 hover:bg-red-500/10 hover:text-red-400'
            : 'text-fg-subtle hover:bg-hover-bg hover:text-fg'
      " :aria-label="label" :title="label" @click.stop="onClick">
    <!-- Скачивается -->
    <template v-if="isDownloading">
      <svg viewBox="0 0 36 36" class="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="2" opacity="0.2" />
        <circle v-if="progressRatio !== null" cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" :stroke-dasharray="`${progressRatio * 94.2} 94.2`" />
      </svg>
      <svg viewBox="0 0 24 24" fill="currentColor"
        class="relative h-3 w-3 opacity-0 transition group-hover:opacity-100">
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
    </template>

    <!-- Remote -->
    <template v-else-if="origin === 'remote'">
      <IconDownload class="h-4 w-4" />
    </template>

    <!-- Downloaded -->
    <template v-else-if="origin === 'downloaded'">
      <IconCheck class="h-4 w-4" />
    </template>

    <!-- Only-local -->
    <template v-else>
      <IconFolder class="h-4 w-4" />
    </template>
  </button>
</template>
