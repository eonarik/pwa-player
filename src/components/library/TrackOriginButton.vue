<!-- src/components/library/TrackOriginButton.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useTrackDownload } from '@/composables/useTrackDownload'
import type { LibraryTrack } from '@/types/library'

const props = defineProps<{
  track: LibraryTrack
}>()

const { isDownloading, progressRatio, download, cancel, remove } =
  useTrackDownload(computed(() => props.track))

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
        ? 'text-active'
        : origin === 'downloaded'
          ? 'text-active hover:bg-red-500/10 hover:text-red-400'
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M16 16l-4 4-4-4M12 20V10" />
        <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
      </svg>
    </template>

    <!-- Downloaded -->
    <template v-else-if="origin === 'downloaded'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="h-4 w-4">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    </template>

    <!-- Only-local -->
    <template v-else>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    </template>
  </button>
</template>
