<!-- src/views/FolderRoute.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
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

/**
 * Гарантирует, что папка обойдена (сама, без подпапок).
 * - scanStatus === 'scanned' → ничего.
 * - scanStatus === 'scanning' → ждём (UI покажет спиннер).
 * - scanStatus === undefined → запускаем scanFolder(folderId, false).
 */
async function ensureFolderScanned(folder: Folder): Promise<void> {
  if (folder.scanStatus === 'scanned') return
  if (folder.scanStatus === 'scanning') return
  if (!folder.source) return

  try {
    const plugin = await loadPlugin(folder.source)
    if (!plugin.scanFolder) return

    const context = createPluginContext(folder.source)
    await plugin.scanFolder(context, folder.id, { recursive: false })
  } catch (err) {
    console.warn(`[folder-route] scan failed for "${folder.path}"`, err)
  }
}

watch(
  [currentFolder, hasLibrary, pluginId],
  async () => {
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

    const folder = currentFolder.value!

    library.setCurrentFolder(folder.id)

    // Если папка не обойдена — форсируем обход одной папки
    void ensureFolderScanned(folder)
  },
  { immediate: true },
)
</script>

<template>
  <FolderView v-if="hasLibrary && folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">
    Загрузка…
  </div>
</template>
