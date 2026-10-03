<!-- src/views/FolderRoute.vue -->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import type { Folder } from '@/types/library'
import FolderView from '@/views/FolderView.vue'

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
 * Ищем папку по source + path.
 * source — это pluginId в URL, который может быть:
 * - 'local' (контейнер локальных папок)
 * - 'local:Music' (конкретная локальная папка)
 * - 'yandex' (Яндекс.Диск)
 */
const currentFolder = computed<Folder | null>(() => {
  const pid = pluginId.value
  if (!pid) return null

  return (
    Object.values(library.folders).find((f) => f.source === pid && f.path === folderPath.value) ??
    null
  )
})

const folderExists = computed(() => Boolean(currentFolder.value))

async function ensureFolderScanned(folder: Folder): Promise<void> {
  if (folder.scanStatus === 'scanned') return
  if (folder.scanStatus === 'scanning') return
  if (!folder.source) return

  try {
    const plugin = await loadPlugin(pluginIdFromSource(folder.source))
    if (!plugin.scanFolder) return

    const context = createPluginContext(pluginIdFromSource(folder.source))
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

    void ensureFolderScanned(folder)
  },
  { immediate: true },
)
</script>

<template>
  <FolderView v-if="hasLibrary && folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка…</div>
</template>
