<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { getPlugins, loadPlugin, pluginIdFromSource, isPluginActivated } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import type { PluginManifest } from '@/plugins/types'

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()

interface PluginMeta {
  manifest: PluginManifest
  available: boolean
}

const pluginMetas = ref<PluginMeta[]>([])
const isLoading = ref<string | null>(null)
const customDataMap = ref<Record<string, boolean>>({})

interface DisplayPlugin extends PluginMeta {
  hasData: boolean
  isStateless: boolean
}

const plugins = computed<DisplayPlugin[]>(() => {
  return pluginMetas.value.map((meta) => {
    // Если плагин stateless, он всегда "подключен", если доступен
    if (meta.manifest.isStateless) {
      return {
        ...meta,
        hasData: true,
        isStateless: true,
      }
    }

    if (meta.manifest.hasCustomData) {
      return {
        ...meta,
        hasData: customDataMap.value[meta.manifest.id] ?? false,
        isStateless: false,
      }
    }

    return {
      ...meta,
      hasData: Object.values(library.folders).some(
        (f) => f.source !== undefined && pluginIdFromSource(f.source) === meta.manifest.id,
      ),
      isStateless: false, // <-- Добавили поле сюда
    }
  })
})

async function loadPlugins() {
  const metas: PluginMeta[] = []
  for (const manifest of getPlugins()) {
    if (manifest.requiresActivation && !isPluginActivated(manifest.id)) continue
    try {
      const plugin = await loadPlugin(manifest.id)
      metas.push({ manifest, available: plugin.isAvailable() })
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
}

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

function openPlugin(row: { manifest: PluginManifest }) {
  if (row.manifest.customRoute) {
    router.push({ name: row.manifest.customRoute })
    return
  }

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
    openPlugin({ manifest: row.manifest })
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

  // Stateless: очищаем данные
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

  // Обычные плагины: отключаем
  const confirmed = window.confirm(`Отключить «${row.manifest.name}»? Данные будут удалены.`)
  if (!confirmed) return

  isLoading.value = row.manifest.id
  try {
    const plugin = await loadPlugin(row.manifest.id)
    const context = createPluginContext(row.manifest.id)
    await plugin.disconnect(context)
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
              <template v-else-if="row.hasData">Подключено</template>
              <template v-else>Не подключено</template>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <!-- Stateless -->
            <template v-if="row.isStateless">
              <button type="button"
                class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
                @click="openPlugin(row)">
                Открыть
              </button>
              <button type="button"
                class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400"
                @click="disconnectPlugin(row)">
                Очистить
              </button>
            </template>

            <!-- Обычные -->
            <template v-else-if="row.hasData">
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
