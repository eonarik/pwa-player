<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import {
  getPlugins,
  loadPlugin,
  isPluginActivated,
  setPluginDisconnected,
} from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { scanDirectory } from '@/services/download/scanDirectory'
import { toastService } from '@/services/ui/ToastService'
import type { PluginManifest, LibrarySource, Folder } from '@/plugins/types'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()

interface PluginMeta {
  manifest: PluginManifest
  plugin: LibrarySource
  available: boolean
  isDisconnected: boolean
}

const pluginMetas = ref<PluginMeta[]>([])
const isLoading = ref<string | null>(null)
const customDataMap = ref<Record<string, boolean>>({})

// Computed, а не ref — обновляется автоматически, когда в настройках
// выбирают папку (hasSpace → true) или меняется permission.
const spaceAvailable = computed(
  () => downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value,
)

interface DisplayPlugin extends PluginMeta {
  hasCustomData: boolean
  hasLocalFiles: boolean
  isStateless: boolean
  spaceAvailable: boolean
}

const plugins = computed<DisplayPlugin[]>(() => {
  return pluginMetas.value.map((meta) => {
    const isStateless = Boolean(meta.manifest.isStateless)
    const hasCustomData = isStateless
      ? Boolean(customDataMap.value[meta.manifest.id])
      : Boolean(meta.manifest.hasCustomData) && Boolean(customDataMap.value[meta.manifest.id])
    const hasLocalFiles = Boolean(customDataMap.value[meta.manifest.id])

    return {
      ...meta,
      isStateless,
      hasCustomData,
      hasLocalFiles,
      spaceAvailable: spaceAvailable.value,
    }
  })
})

async function checkLocalFiles(pluginId: string): Promise<boolean> {
  if (!downloadSpaceService.hasSpace.value) return false

  try {
    const dir = await downloadSpaceService.getPluginDirIfExists(pluginId)
    if (!dir) return false
    const files = await scanDirectory(dir)
    return files.size > 0
  } catch {
    return false
  }
}

async function loadPlugins() {
  const metas: PluginMeta[] = []
  for (const manifest of getPlugins()) {
    if (manifest.requiresActivation && !isPluginActivated(manifest.id)) continue
    try {
      const plugin = await loadPlugin(manifest.id)
      metas.push({
        manifest,
        plugin,
        available: plugin.isAvailable(),
        isDisconnected: plugin.isDisconnected?.() ?? false,
      })
    } catch (err) {
      console.warn(`[home] failed to load plugin ${manifest.id}`, err)
    }
  }
  pluginMetas.value = metas

  for (const meta of metas) {
    if (meta.manifest.hasCustomData) {
      try {
        customDataMap.value[meta.manifest.id] = await meta.manifest.hasCustomData()
      } catch {
        customDataMap.value[meta.manifest.id] = false
      }
    }
  }

  for (const meta of metas) {
    if (!meta.plugin.canDownload) continue
    if (!spaceAvailable.value) continue
    try {
      const hasLocal = await checkLocalFiles(meta.manifest.id)
      if (hasLocal) {
        customDataMap.value[meta.manifest.id] = true
      }
    } catch (err) {
      console.warn(`[home] failed to check local files for ${meta.manifest.id}`, err)
    }
  }
}

// Если HomeView не перемонтировался (например, переиспользован роутером),
// а папку в настройках только что выбрали — догоняем проверку локальных файлов.
watch(
  () => spaceAvailable.value,
  async (has, prev) => {
    if (has && !prev) {
      await loadPlugins()
    }
  },
)

onMounted(async () => {
  await loadPlugins()

  if (route.query.auth === 'ok') {
    await router.replace({ path: route.path })
    const yandexMeta = pluginMetas.value.find((m) => m.manifest.id === 'yandex')
    if (yandexMeta) {
      await connectPlugin({ manifest: yandexMeta.manifest })
    }
  }
})

function hasTracksInTree(folderId: string): boolean {
  const folder = library.getFolder(folderId)
  if (!folder) return false
  if (folder.trackIds.length > 0) return true
  for (const childId of folder.childFolderIds) {
    if (hasTracksInTree(childId)) return true
  }
  return false
}

interface OpenPluginOptions {
  /** true — не трогаем облачный кеш, строим только из папки скачивания */
  localOnly: boolean
}

async function openPlugin(row: { manifest: PluginManifest }, options: OpenPluginOptions) {
  if (row.manifest.customRoute) {
    router.push({ name: row.manifest.customRoute })
    return
  }

  if (downloadSpaceService.hasSpace.value && downloadSpaceService.needsPermission.value) {
    const state = await downloadSpaceService.requestAccess()
    if (state !== 'granted') {
      toastService.error('Нет доступа к папке скачивания. Подтвердите доступ и попробуйте снова.')
      return
    }
  }

  const plugin = await loadPlugin(row.manifest.id)
  const context = createPluginContext(row.manifest.id)

  const findRoot = (): Folder | undefined =>
    Object.values(library.folders).find(
      (f) => f.source === row.manifest.id && f.parentId === null,
    )

  let root = findRoot()

  // 1. Пробуем облачный кеш (для yandex / yandex-self).
  if (!options.localOnly && (!root || !hasTracksInTree(root.id))) {
    try {
      await plugin.restoreFromCache(context)
      root = findRoot()
    } catch (err) {
      console.warn('[home] failed to restore from cache', err)
    }
  }

  // 2. Локальные скачанные файлы (для yandex / yandex-self).
  if (!root || !hasTracksInTree(root.id)) {
    if (plugin.restoreFromLocalFiles) {
      try {
        const ok = await plugin.restoreFromLocalFiles(context)
        console.info(`[home] restoreFromLocalFiles("${row.manifest.id}") → ${ok}`)
        root = findRoot()
      } catch (err) {
        console.warn('[home] failed to restore from local files', err)
        toastService.error(err instanceof Error ? err.message : 'Не удалось прочитать локальные файлы')
        return
      }
    }
  }

  // 3. Для плагинов без локального восстановления (local) — вызываем connect + load.
  //    Для local это откроет системный диалог выбора папки.
  if ((!root || !hasTracksInTree(root.id)) && !plugin.restoreFromLocalFiles && !options.localOnly) {
    try {
      await plugin.connect(context)
      await plugin.load(context, { forceRefresh: true })
      root = findRoot()
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return
      if (err instanceof Error && err.message === 'redirect') return
      console.warn(`[home] connect+load for "${row.manifest.id}" failed`, err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось подключить источник')
      return
    }
  }

  if (!root) {
    toastService.error(`Источник «${row.manifest.name}» не содержит данных`)
    return
  }

  library.setCurrentFolder(root.id)
  const segments = root.path.split('/').filter(Boolean)
  router.push({ name: 'folder', params: { pluginId: row.manifest.id, path: segments } })
}

async function onOpen(row: DisplayPlugin) {
  await openPlugin(row, { localOnly: false })
}

async function onOpenLocal(row: DisplayPlugin) {
  await openPlugin(row, { localOnly: true })
}

async function connectPlugin(row: { manifest: PluginManifest }) {
  if (isLoading.value) return
  isLoading.value = row.manifest.id

  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)

    await plugin.connect(context)
    setPluginDisconnected(row.manifest.id, false)
    // load() сам делает mergeLocalIntoLibrary до и после облачного скана
    // и сохраняет кеш через yandexPersistenceService.save.
    await plugin.load(context, { forceRefresh: true })

    toastService.success(`Источник «${row.manifest.name}» подключён`)
    await loadPlugins()

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

async function disconnectPlugin(row: { manifest: PluginManifest }) {
  if (isLoading.value) return

  if (row.manifest.isStateless) {
    const confirmed = window.confirm(`Очистить данные «${row.manifest.name}»?`)
    if (!confirmed) return

    if (row.manifest.clearData) {
      await row.manifest.clearData()
      toastService.info(`Данные «${row.manifest.name}» очищены`)
      await loadPlugins()
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
    await loadPlugins()
    toastService.info(`Источник «${row.manifest.name}» отключён`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Не удалось отключить'
    toastService.error(message)
  } finally {
    isLoading.value = null
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <div class="mx-auto w-full max-w-2xl">
      <h1 class="mb-1 text-2xl font-medium text-fg">CUEI Media Player</h1>
      <p class="mb-6 text-sm text-fg-muted">Выберите источник музыки</p>

      <div v-if="plugins.length === 0" class="text-sm text-fg-muted">Плагины не найдены</div>

      <div v-else class="flex flex-col gap-2">
        <div v-for="row in plugins" :key="row.manifest.id"
          class="flex items-center gap-4 rounded-card bg-card-bg p-4 transition hover:bg-hover-bg">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-hover-bg text-2xl">
            {{ row.manifest.icon }}
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-fg">
              {{ row.manifest.name }}
            </p>
            <p class="truncate text-xs text-fg-muted">
              <template v-if="!row.available">Недоступно в этом браузере</template>
              <template v-else-if="row.isStateless">Доступно</template>
              <template v-else-if="!row.isDisconnected">Подключено</template>
              <template v-else-if="row.hasLocalFiles">Отключено (есть локальные файлы)</template>
              <template v-else>Отключено</template>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <template v-if="row.isStateless">
              <button type="button"
                class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
                @click="onOpen(row)">
                Открыть
              </button>
              <button v-if="row.hasCustomData" type="button"
                class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                @click="disconnectPlugin(row)">
                Очистить
              </button>
            </template>

            <template v-else-if="!row.isDisconnected">
              <button type="button"
                class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
                @click="onOpen(row)">
                Открыть
              </button>
              <button type="button"
                class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                :disabled="isLoading === row.manifest.id" @click="disconnectPlugin(row)">
                Отключить
              </button>
            </template>

            <template v-else-if="row.spaceAvailable && row.hasLocalFiles">
              <button type="button"
                class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
                @click="onOpenLocal(row)">
                Открыть локально
              </button>
              <button type="button"
                class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
                :disabled="isLoading === row.manifest.id" @click="connectPlugin(row)">
                {{ isLoading === row.manifest.id ? 'Подключение…' : 'Подключить' }}
              </button>
            </template>

            <button v-else type="button"
              class="rounded-btn bg-card-bg px-4 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!row.available || isLoading === row.manifest.id" @click="connectPlugin(row)">
              {{ isLoading === row.manifest.id ? 'Подключение…' : 'Подключить' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
