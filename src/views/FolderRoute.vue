<!-- src/views/FolderRoute.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { folderIdFromPath, ROOT_FOLDER_ID } from '@/services/library/id'
import FolderView from '@/components/library/FolderView.vue'

const route = useRoute()
const library = useLibraryStore()
const { hasLibrary } = storeToRefs(library)

const pathSegments = computed<string[]>(() => {
  const raw = route.params.path
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string' && raw.length > 0) return [raw]
  return []
})

const folderPath = computed(() => pathSegments.value.join('/'))

const folderId = computed(() =>
  folderPath.value === '' ? ROOT_FOLDER_ID : folderIdFromPath(folderPath.value),
)

const folderExists = computed(() => Boolean(library.folders[folderId.value]))

// Синхронизация URL → стор (без редиректов)
watch(
  [folderId, hasLibrary],
  () => {
    if (!hasLibrary.value) return
    if (!folderExists.value) return
    library.setCurrentFolder(folderId.value)
  },
  { immediate: true },
)
</script>

<template>
  <FolderView v-if="hasLibrary && folderExists" />

  <div
    v-else-if="hasLibrary && !folderExists"
    class="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500"
  >
    <p>Папка не найдена</p>
    <RouterLink
      :to="{ name: 'folder', params: { path: [] } }"
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
    >
      К библиотеке
    </RouterLink>
  </div>

  <div v-else class="flex h-full items-center justify-center text-sm text-zinc-500">Загрузка…</div>
</template>
