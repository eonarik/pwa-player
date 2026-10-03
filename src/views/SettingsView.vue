<!-- src/views/SettingsView.vue -->
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { schemaService } from '@/services/persistence/SchemaService'
import { toastService } from '@/services/ui/ToastService'
import { getPlugins } from '@/plugins/registry'
import type { PluginManifest } from '@/plugins/types'
import type { PluginSettingsSchema } from '@/plugins/settingsTypes'
import PluginSettingsSection from '@/components/settings/PluginSettingsSection.vue'

const uiSettings = useUiSettingsStore()
const history = useHistoryStore()
const dislikes = useDislikesStore()

const { showSource, metadataThreshold, searchThreshold } = storeToRefs(uiSettings)

const spaceName = computed(() => downloadSpaceService.spaceName.value)
const needsPermission = computed(() => downloadSpaceService.needsPermission.value)
const hasSpace = computed(() => downloadSpaceService.hasSpace.value)

const appVersion = __APP_VERSION__
const buildHash = __BUILD_HASH__
const shortHash = buildHash.slice(0, 7)

// --- Пороги (локальные значения для валидации) -----------------------

const localSearchThreshold = ref(searchThreshold.value)
const localMetadataThreshold = ref(metadataThreshold.value)

function applySearchThreshold() {
  const v = Number(localSearchThreshold.value)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localSearchThreshold.value = searchThreshold.value
    return
  }
  uiSettings.setSearchThreshold(v)
  localSearchThreshold.value = v
}

function applyMetadataThreshold() {
  const v = Number(localMetadataThreshold.value)
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    localMetadataThreshold.value = metadataThreshold.value
    return
  }
  uiSettings.setMetadataThreshold(v)
  localMetadataThreshold.value = v
}

// --- Спейс -----------------------------------------------------------

const isPickingSpace = ref(false)

async function pickSpace() {
  if (isPickingSpace.value) return
  isPickingSpace.value = true
  try {
    const handle = await downloadSpaceService.pickSpace()
    if (handle) {
      toastService.success('Папка скачивания выбрана')
    }
  } finally {
    isPickingSpace.value = false
  }
}

async function restoreAccess() {
  const state = await downloadSpaceService.requestAccess()
  if (state === 'granted') {
    toastService.success('Доступ восстановлен')
  } else {
    toastService.error('Доступ отклонён')
  }
}

// --- Плагины с настройками -------------------------------------------

interface PluginSchema {
  manifest: PluginManifest
  schema: PluginSettingsSchema
}

const pluginSchemas = ref<PluginSchema[]>([])
const isPluginActionRunning = ref(false)

async function loadPluginSchemas() {
  const result: PluginSchema[] = []
  for (const manifest of getPlugins()) {
    if (!manifest.getSettings) continue
    try {
      const schema = await manifest.getSettings()
      result.push({ manifest, schema })
    } catch (err) {
      console.warn(`[settings] failed to load settings for ${manifest.id}`, err)
    }
  }
  pluginSchemas.value = result
}

async function onPluginAction(manifest: PluginManifest, actionId: string, payload?: unknown) {
  if (!manifest.runSettingsAction) return
  if (isPluginActionRunning.value) return

  isPluginActionRunning.value = true
  try {
    await manifest.runSettingsAction(actionId, payload)
  } catch (err) {
    console.error('[settings] plugin action failed', err)
    toastService.error('Не удалось выполнить действие')
  } finally {
    isPluginActionRunning.value = false
    await loadPluginSchemas()
  }
}

async function onPluginChange(manifest: PluginManifest, fieldId: string, value: unknown) {
  // Пока не используем — только пороги/тогглы ядра
  console.log('[settings] plugin change', manifest.id, fieldId, value)
}

onMounted(() => {
  void loadPluginSchemas()
})

// --- Сброс данных ----------------------------------------------------

function clearHistory() {
  if (!window.confirm('Очистить историю воспроизведения?')) return
  history.clear()
  toastService.success('История очищена')
}

function clearDislikes() {
  if (!window.confirm('Очистить список дизлайков?')) return
  dislikes.clear()
  toastService.success('Дизлайки очищены')
}

function clearMetadataCache() {
  if (!window.confirm('Очистить кэш метаданных?')) return
  void metadataPersistenceService.clear()
  toastService.success('Кэш метаданных очищен')
}

async function resetAll() {
  if (
    !window.confirm(
      'Сбросить все данные приложения? Это удалит библиотеку, плейлисты, историю, настройки. Действие необратимо.',
    )
  ) {
    return
  }
  await schemaService.clearAll()
  location.reload()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-2xl items-center">
        <h1 class="text-lg font-medium text-fg">Настройки</h1>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 pb-10">
        <!-- Поиск -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Поиск</h2>

          <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm text-fg">Порог совпадения</p>
              <p class="text-xs text-fg-muted">Чем выше, тем строже поиск</p>
            </div>

            <input
              v-model.number="localSearchThreshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none"
              @blur="applySearchThreshold"
              @keydown.enter="applySearchThreshold"
            />
          </div>
        </section>

        <!-- Метаданные -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            Метаданные
          </h2>

          <div class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm text-fg">Порог совпадения</p>
              <p class="text-xs text-fg-muted">Ниже порога — трек в «Проблемные»</p>
            </div>

            <input
              v-model.number="localMetadataThreshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="w-20 rounded-btn bg-bg-elevated px-2 py-1 text-right text-sm text-fg focus:outline-none"
              @blur="applyMetadataThreshold"
              @keydown.enter="applyMetadataThreshold"
            />
          </div>
        </section>

        <!-- Отображение -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            Отображение
          </h2>

          <label
            class="flex cursor-pointer items-center justify-between gap-4 bg-card-bg px-4 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm text-fg">Показывать источник</p>
              <p class="text-xs text-fg-muted">Путь к папке в списках треков</p>
            </div>

            <input
              v-model="showSource"
              type="checkbox"
              class="h-4 w-4 cursor-pointer accent-active"
            />
          </label>
        </section>

        <!-- Папка скачивания -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            Папка скачивания
          </h2>

          <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm text-fg">
                  <template v-if="hasSpace">
                    {{ spaceName ?? 'Папка выбрана' }}
                  </template>
                  <template v-else>Папка не выбрана</template>
                </p>
                <p v-if="needsPermission" class="text-xs text-amber-400">
                  Требуется подтвердить доступ
                </p>
                <p v-else-if="hasSpace" class="text-xs text-fg-muted">Доступ есть</p>
                <p v-else class="text-xs text-fg-muted">Для скачивания треков</p>
              </div>

              <button
                v-if="needsPermission"
                type="button"
                class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
                @click="restoreAccess"
              >
                Восстановить
              </button>

              <button
                v-else
                type="button"
                class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
                :disabled="isPickingSpace"
                @click="pickSpace"
              >
                {{ isPickingSpace ? '…' : hasSpace ? 'Сменить' : 'Выбрать' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Плагины -->
        <section v-if="pluginSchemas.length > 0">
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Плагины</h2>

          <div class="flex flex-col gap-6">
            <div v-for="p in pluginSchemas" :key="p.manifest.id" class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="text-base">{{ p.manifest.icon }}</span>
                <span class="text-sm font-medium text-fg">{{ p.manifest.name }}</span>
              </div>

              <PluginSettingsSection
                v-for="section in p.schema.sections"
                :key="section.id"
                :section="section"
                :disabled="isPluginActionRunning"
                @action="(id, payload) => onPluginAction(p.manifest, id, payload)"
                @change="(id, value) => onPluginChange(p.manifest, id, value)"
              />
            </div>
          </div>
        </section>

        <!-- Сброс данных -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Данные</h2>

          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
              @click="clearHistory"
            >
              <div class="min-w-0">
                <p class="text-sm text-fg">Очистить историю</p>
                <p class="text-xs text-fg-muted">Удалить все записи о воспроизведении</p>
              </div>
            </button>

            <button
              type="button"
              class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
              @click="clearDislikes"
            >
              <div class="min-w-0">
                <p class="text-sm text-fg">Очистить дизлайки</p>
                <p class="text-xs text-fg-muted">Удалить все скрытые треки</p>
              </div>
            </button>

            <button
              type="button"
              class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
              @click="clearMetadataCache"
            >
              <div class="min-w-0">
                <p class="text-sm text-fg">Очистить кэш метаданных</p>
                <p class="text-xs text-fg-muted">Найденные обложки и метаданные будут забыты</p>
              </div>
            </button>

            <button
              type="button"
              class="flex items-center justify-between gap-4 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/15"
              @click="resetAll"
            >
              <div class="min-w-0">
                <p class="text-sm text-red-400">Сбросить все данные</p>
                <p class="text-xs text-red-400/70">
                  Библиотека, плейлисты, история, настройки. Необратимо.
                </p>
              </div>
            </button>
          </div>
        </section>

        <!-- О приложении -->
        <section>
          <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
            О приложении
          </h2>

          <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-fg">Версия</span>
              <span class="text-xs tabular-nums text-fg-muted">
                {{ appVersion }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-sm text-fg">Хэш билда</span>
              <span class="text-xs tabular-nums text-fg-muted">
                {{ shortHash }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
