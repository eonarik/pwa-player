<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { getPlugins, loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import type { PluginManifest } from '@/plugins/types'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()

interface PluginMeta {
  manifest: PluginManifest
  available: boolean
}

const pluginMetas = ref<PluginMeta[]>([])
const isLoading = ref<string | null>(null)

const plugins = computed(() => {
  return pluginMetas.value.map((meta) => ({
    ...meta,
    hasData: Object.values(library.folders).some(
      (f) => f.source !== undefined && pluginIdFromSource(f.source) === meta.manifest.id,
    ),
  }))
})

onMounted(async () => {
  const metas: PluginMeta[] = []
  for (const manifest of getPlugins()) {
    try {
      const plugin = await loadPlugin(manifest.id)
      metas.push({ manifest, available: plugin.isAvailable() })
    } catch (err) {
      console.warn(`[home] failed to load plugin ${manifest.id}`, err)
    }
  }
  pluginMetas.value = metas
})

function openPlugin(row: { manifest: PluginManifest; hasData: boolean }) {
  const root = Object.values(library.folders).find(
    (f) => f.source === row.manifest.id && f.parentId === null,
  )
  if (!root) {
    toastService.error(`Источник «${row.manifest.name}» не подключён`)
    return
  }

  library.setCurrentFolder(root.id)
  const segments = root.path.split('/').filter(Boolean)
  router.push({
    name: 'folder',
    params: { pluginId: row.manifest.id, path: segments },
  })
}

async function connectPlugin(row: { manifest: PluginManifest }) {
  if (isLoading.value) return
  isLoading.value = row.manifest.id

  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)

    await plugin.connect(context)
    await plugin.load(context, { forceRefresh: true })

    toastService.success(`Источник «${row.manifest.name}» подключён`)
    openPlugin({ manifest: row.manifest, hasData: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'cancelled') {
      return
    }
    const message = err instanceof Error ? err.message : 'Не удалось подключить источник'
    toastService.error(message)
  } finally {
    isLoading.value = null
  }
}

async function disconnectPlugin(row: { manifest: PluginManifest }) {
  if (isLoading.value) return

  const confirmed = window.confirm(`Отключить «${row.manifest.name}»? Данные будут удалены.`)
  if (!confirmed) return

  isLoading.value = row.manifest.id
  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)
    await plugin.disconnect(context)

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

      <div v-if="plugins.length === 0" class="text-sm text-fg-muted">
        Плагины не найдены
      </div>

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
              <template v-else-if="row.hasData">Подключено</template>
              <template v-else>Не подключено</template>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <template v-if="row.hasData">
              <button type="button"
                class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
                @click="openPlugin(row)">
                Открыть
              </button>
              <button type="button"
                class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                :disabled="isLoading === row.manifest.id" @click="disconnectPlugin(row)">
                Отключить
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
