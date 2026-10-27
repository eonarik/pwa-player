// src/composables/usePluginActions.ts

import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore, createLibraryWriter } from '@/stores/library'
import { loadPlugin, setPluginDisconnected } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { toastService } from '@/services/ui/ToastService'
import type { PluginManifest } from '@/plugins/types'
import type { Folder } from '@/types/library'

export interface PluginActionsOptions {
  onReload: () => Promise<void>
}

export function usePluginActions({ onReload }: PluginActionsOptions) {
  const router = useRouter()
  const library = useLibraryStore()

  const isLoading = ref<string | null>(null)

  function isOpening(pluginId: string): boolean {
    return isLoading.value === pluginId
  }

  function hasTracksInTree(folderId: string): boolean {
    const folder = library.getFolder(folderId)
    if (!folder) return false
    if (folder.trackIds.length > 0) return true
    for (const childId of folder.childFolderIds) {
      if (hasTracksInTree(childId)) return true
    }
    return false
  }

  function findRoot(sourceId: string): Folder | undefined {
    return Object.values(library.folders).find((f) => f.source === sourceId && f.parentId === null)
  }

  async function openPlugin(
    row: { manifest: PluginManifest },
    options: { localOnly: boolean },
  ): Promise<void> {
    if (row.manifest.customRoute) {
      router.push({ name: row.manifest.customRoute })
      return
    }

    if (isLoading.value) return
    isLoading.value = row.manifest.id

    try {
      if (downloadSpaceService.hasSpace.value && downloadSpaceService.needsPermission.value) {
        const state = await downloadSpaceService.requestAccess()
        if (state !== 'granted') {
          toastService.error(
            'Нет доступа к папке скачивания. Подтвердите доступ и попробуйте снова.',
          )
          return
        }
      }

      const plugin = await loadPlugin(row.manifest.id)
      const context = createPluginContext(row.manifest.id)

      if (options.localOnly) {
        let restored = false
        if (plugin.restoreFromLocalFiles) {
          try {
            restored = await plugin.restoreFromLocalFiles(context)
          } catch (err) {
            console.warn('[home] restoreFromLocalFiles failed', err)
            toastService.error(
              err instanceof Error ? err.message : 'Не удалось прочитать локальные файлы',
            )
            return
          }
        }

        if (!restored) {
          toastService.error(`Локальные файлы для «${row.manifest.name}» не найдены`)
          return
        }

        const root = findRoot(row.manifest.id)
        if (!root) {
          toastService.error(`Источник «${row.manifest.name}» не содержит данных`)
          return
        }

        library.setCurrentFolder(root.id)
        const segments = root.path.split('/').filter(Boolean)
        router.push({ name: 'folder', params: { pluginId: row.manifest.id, path: segments } })
        return
      }

      // Облачный режим.
      let root = findRoot(row.manifest.id)
      if (!root || !hasTracksInTree(root.id)) {
        try {
          await plugin.restoreFromCache(context)
        } catch (err) {
          console.warn('[home] failed to restore from cache', err)
        }
        root = findRoot(row.manifest.id)
      }

      if (root && hasTracksInTree(root.id)) {
        library.setCurrentFolder(root.id)
        const segments = root.path.split('/').filter(Boolean)
        router.push({ name: 'folder', params: { pluginId: row.manifest.id, path: segments } })
        return
      }

      if (plugin.isDisconnected?.()) {
        try {
          await plugin.connect(context)
        } catch (err) {
          if (err instanceof Error && err.message === 'cancelled') return
          if (err instanceof Error && err.message === 'redirect') return
          console.warn(`[home] connect for "${row.manifest.id}" failed`, err)
          toastService.error(err instanceof Error ? err.message : 'Не удалось подключить источник')
          return
        }
      }

      try {
        await plugin.load(context, { forceRefresh: true })
      } catch (err) {
        console.warn(`[home] load for "${row.manifest.id}" failed`, err)
        toastService.error(err instanceof Error ? err.message : 'Не удалось загрузить источник')
        return
      }

      root = findRoot(row.manifest.id)
      if (!root) {
        toastService.error(`Источник «${row.manifest.name}» не содержит данных`)
        return
      }

      library.setCurrentFolder(root.id)
      const segments = root.path.split('/').filter(Boolean)
      router.push({ name: 'folder', params: { pluginId: row.manifest.id, path: segments } })
    } finally {
      isLoading.value = null
    }
  }

  async function connectPlugin(row: { manifest: PluginManifest }): Promise<void> {
    if (isLoading.value) return
    isLoading.value = row.manifest.id

    try {
      const plugin = await loadPlugin(row.manifest.id)
      const context = createPluginContext(row.manifest.id)

      // 1. Подключаемся (OAuth / пароль)
      await plugin.connect(context)
      setPluginDisconnected(row.manifest.id, false)

      // 2. Загружаем данные (из кеша или из облака)
      await plugin.load(context, { forceRefresh: false })

      toastService.success(`Источник «${row.manifest.name}» подключён`)

      // 3. Обновляем список плагинов в UI (checkSession и т.д.)
      await onReload()
      await nextTick()

      // 4. Переходим внутрь
      await openPlugin({ manifest: row.manifest }, { localOnly: false })
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return
      if (err instanceof Error && err.message === 'redirect') return
      const message = err instanceof Error ? err.message : 'Не удалось подключить источник'
      toastService.error(message)
    } finally {
      isLoading.value = null
    }
  }

  async function disconnectPlugin(row: { manifest: PluginManifest }): Promise<void> {
    if (isLoading.value) return

    if (row.manifest.isStateless) {
      const confirmed = window.confirm(`Очистить данные «${row.manifest.name}»?`)
      if (!confirmed) return

      if (row.manifest.clearData) {
        await row.manifest.clearData()
        toastService.info(`Данные «${row.manifest.name}» очищены`)
        await onReload()
      }
      return
    }

    const confirmed = window.confirm(
      `Отключить «${row.manifest.name}»? Скачанные треки останутся на устройстве.`,
    )
    if (!confirmed) return

    isLoading.value = row.manifest.id
    try {
      const plugin = await loadPlugin(row.manifest.id)
      const context = createPluginContext(row.manifest.id)
      await plugin.disconnect(context)
      setPluginDisconnected(row.manifest.id, true)

      const writer = createLibraryWriter()
      writer.removeBySource(row.manifest.id)

      await onReload()
      toastService.info(`Источник «${row.manifest.name}» отключён`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отключить'
      toastService.error(message)
    } finally {
      isLoading.value = null
    }
  }

  return {
    isLoading,
    isOpening,
    openPlugin,
    connectPlugin,
    disconnectPlugin,
  }
}
