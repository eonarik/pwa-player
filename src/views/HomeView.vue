<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import type { PluginManifest } from '@/plugins/types'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()

interface PluginMeta {
  manifest: PluginManifest
  available: boolean
}

/** Статичные метаданные плагинов — грузятся один раз */
const pluginMetas = ref<PluginMeta[]>([])
const isLoading = ref<string | null>(null)
const error = ref<string | null>(null)

/**
 * Реактивный список: hasData пересчитывается автоматически,
 * когда library.folders меняется (например, после restoreFromCache).
 */
const plugins = computed(() => {
  return pluginMetas.value.map((meta) => ({
    ...meta,
    hasData: Object.values(library.folders).some((f) => f.source === meta.manifest.id),
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

// --- Открыть источник (если данные уже есть) --------------------------

function openPlugin(row: { manifest: PluginManifest; hasData: boolean }) {
  const root = Object.values(library.folders).find(
    (f) => f.source === row.manifest.id && f.parentId === null,
  )
  if (!root) return

  library.setCurrentFolder(root.id)
  const segments = root.path.split('/').filter(Boolean)
  router.push({
    name: 'folder',
    params: { pluginId: row.manifest.id, path: segments },
  })
}

// --- Подключить источник (загрузка с нуля) ----------------------------

async function connectPlugin(row: { manifest: PluginManifest }) {
  error.value = null
  isLoading.value = row.manifest.id

  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)

    await plugin.connect(context)
    await plugin.load(context, { forceRefresh: true })

    openPlugin({ manifest: row.manifest, hasData: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'cancelled') {
      return
    }
    error.value = err instanceof Error ? err.message : 'Не удалось подключить источник'
  } finally {
    isLoading.value = null
  }
}

// --- Отключить --------------------------------------------------------

async function disconnectPlugin(row: { manifest: PluginManifest }) {
  const confirmed = window.confirm(`Отключить «${row.manifest.name}»? Данные будут удалены.`)
  if (!confirmed) return

  isLoading.value = row.manifest.id
  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)
    await plugin.disconnect(context)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось отключить'
  } finally {
    isLoading.value = null
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <div class="mx-auto w-full max-w-2xl">
      <h1 class="mb-1 text-2xl font-medium text-zinc-100">CUEI Media Player</h1>
      <p class="mb-6 text-sm text-zinc-500">Выберите источник музыки</p>

      <div v-if="plugins.length === 0" class="text-sm text-zinc-500">
        Плагины не найдены
      </div>

      <div v-else class="flex flex-col gap-2">
        <div v-for="row in plugins" :key="row.manifest.id"
          class="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-2xl">
            {{ row.manifest.icon }}
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-zinc-100">
              {{ row.manifest.name }}
            </p>
            <p class="truncate text-xs text-zinc-500">
              <template v-if="!row.available">Недоступно в этом браузере</template>
              <template v-else-if="row.hasData">Подключено</template>
              <template v-else>Не подключено</template>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <template v-if="row.hasData">
              <button type="button"
                class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
                @click="openPlugin(row)">
                Открыть
              </button>
              <button type="button"
                class="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:border-red-500/60 hover:text-red-400"
                :disabled="isLoading === row.manifest.id" @click="disconnectPlugin(row)">
                Отключить
              </button>
            </template>

            <button v-else type="button"
              class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!row.available || isLoading === row.manifest.id" @click="connectPlugin(row)">
              {{ isLoading === row.manifest.id ? 'Подключение…' : 'Подключить' }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-400">{{ error }}</p>
    </div>
  </div>
</template>
