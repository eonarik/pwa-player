<!-- src/components/library/FolderList.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import type { Folder } from '@/types/library'

const router = useRouter()
const library = useLibraryStore()
const { currentSubfolders } = storeToRefs(library)

function formatCount(n: number): string {
  if (n === 0) return 'пусто'
  if (n === 1) return '1 трек'
  if (n >= 2 && n <= 4) return `${n} трека`
  return `${n} треков`
}

function openFolder(folder: Folder) {
  const segments = folder.path.split('/').filter(Boolean)
  router.push({ name: 'folder', params: { path: segments } })
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5 px-2 py-2">
    <button
      v-for="folder in currentSubfolders"
      :key="folder.id"
      type="button"
      class="group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-zinc-300 transition hover:bg-zinc-800/60"
      @click="openFolder(folder)"
    >
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-zinc-800">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          class="h-5 w-5 text-zinc-500"
        >
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ folder.name }}</p>
        <p class="truncate text-xs text-zinc-500">
          {{ formatCount(folder.totalTrackCount) }}
        </p>
      </div>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-zinc-400"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  </div>
</template>
