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

const pathSegments = computed<string[]>(() => {
  const raw = route.params.path
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string' && raw.length > 0) return [raw]
  return []
})

/** Путь в формате библиотеки: 'Rock/2020/OK Computer' или '' для корня */
const folderPath = computed(() => pathSegments.value.join('/'))

/**
 * Ищем папку по `path`, а не по «синтетическому» id.
 * Это работает и для локальной библиотеки, и для Яндекс.Диска —
 * у них разные схемы id, но один и тот же `path`.
 */
const currentFolder = computed<Folder | null>(() => {
  if (folderPath.value === '') {
    if (!library.rootFolderId) return null
    return library.getFolder(library.rootFolderId)
  }
  return Object.values(library.folders).find((f) => f.path === folderPath.value) ?? null
})

const folderExists = computed(() => Boolean(currentFolder.value))

watch(
  [currentFolder, hasLibrary],
  () => {
    if (!hasLibrary.value) {
      // Библиотеки нет — на главную, там выберем источник
      router.replace({ name: 'home' })
      return
    }

    if (!folderExists.value) {
      // Папка не найдена — редирект в корень библиотеки.
      // Библиотеку НЕ трогаем: clear() здесь был бы разрушительным.
      console.warn(`[folder-route] path "${folderPath.value}" not found, going to root`)
      router.replace({ name: 'folder', params: { path: [] } })
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
