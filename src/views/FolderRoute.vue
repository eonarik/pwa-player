<!-- src/views/FolderRoute.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import type { Folder } from '@/types/library'
import FolderView from '@/components/library/FolderView.vue'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const { hasLibrary } = storeToRefs(library)

const pluginId = computed(() => String(route.params.pluginId ?? ''))

const pathSegments = computed<string[]>(() => {
  const raw = route.params.path
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string' && raw.length > 0) return [raw]
  return []
})

const folderPath = computed(() => pathSegments.value.join('/'))

/**
 * Ищем папку:
 * - Если путь пустой → корень этого плагина (parentId === null, source === pluginId).
 * - Если путь непустой → папку с таким path внутри этого плагина.
 */
const currentFolder = computed<Folder | null>(() => {
  const pid = pluginId.value
  if (!pid) return null

  if (folderPath.value === '') {
    return (
      Object.values(library.folders).find(
        (f) => f.source === pid && f.parentId === null,
      ) ?? null
    )
  }

  return (
    Object.values(library.folders).find(
      (f) => f.source === pid && f.path === folderPath.value,
    ) ?? null
  )
})

const folderExists = computed(() => Boolean(currentFolder.value))

watch(
  [currentFolder, hasLibrary, pluginId],
  () => {
    if (!pluginId.value) {
      router.replace({ name: 'home' })
      return
    }

    if (!hasLibrary.value) {
      router.replace({ name: 'home' })
      return
    }

    if (!folderExists.value) {
      console.warn(
        `[folder-route] plugin="${pluginId.value}" path="${folderPath.value}" not found, going home`,
      )
      router.replace({ name: 'home' })
      return
    }

    library.setCurrentFolder(currentFolder.value!.id)
  },
  { immediate: true },
)
</script>

<template>
  <FolderView v-if="hasLibrary && folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-zinc-500">Загрузка…</div>
</template>
