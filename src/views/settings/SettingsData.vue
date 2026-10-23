<!-- src/views/settings/SettingsData.vue -->
<script setup lang="ts">
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { schemaService } from '@/services/persistence/SchemaService'
import { toastService } from '@/services/ui/ToastService'
import { yandexSelfService } from '@/plugins/yandexSelf/YandexSelfService'
import SectionTitle from '@/components/ui/SectionTitle.vue'

const history = useHistoryStore()
const dislikes = useDislikesStore()

function clearHistory(): void {
  if (!window.confirm('Очистить историю воспроизведения?')) return
  history.clear()
  toastService.success('История очищена')
}

function clearDislikes(): void {
  if (!window.confirm('Очистить список дизлайков?')) return
  dislikes.clear()
  toastService.success('Дизлайки очищены')
}

function clearMetadataCache(): void {
  if (!window.confirm('Очистить кэш метаданных?')) return
  void metadataPersistenceService.clear()
  toastService.success('Кэш метаданных очищен')
}

const LOCAL_STORAGE_PREFIXES = ['radio:', 'podcasts:'] as const

/** Ключи, которые после сброса должны быть удалены. */
const LOCAL_STORAGE_KEYS_TO_DELETE = [
  'yandex-self-access',
  'yandex-self-refresh',
  'plugin-activated:yandex-self',
  'ui:theme',
] as const

/** Ключи, которые после сброса должны быть выставлены в 'true'. */
const LOCAL_STORAGE_KEYS_TO_DISCONNECT = [
  'yandex-disconnected',
  'yandex-self-disconnected',
] as const

function clearLocalStorageData(): void {
  try {
    for (const key of LOCAL_STORAGE_KEYS_TO_DELETE) {
      localStorage.removeItem(key)
    }
    for (const key of Object.keys(localStorage)) {
      for (const prefix of LOCAL_STORAGE_PREFIXES) {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key)
          break
        }
      }
    }
    // «Сброс данных» = источник больше не подключён: после reload
    // isDisconnected() должен вернуть true, чтобы HomeView показал
    // «Открыть локально» + «Подключить» (если папка скачивания доступна).
    for (const key of LOCAL_STORAGE_KEYS_TO_DISCONNECT) {
      localStorage.setItem(key, 'true')
    }
  } catch (err) {
    console.warn('[settings] failed to clear localStorage', err)
  }
}

async function resetAll(): Promise<void> {
  if (!window.confirm('Сбросить все данные приложения? Действие необратимо.')) return
  yandexSelfService.logout()
  await schemaService.clearAll()
  clearLocalStorageData()
  location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <SectionTitle text="Очистка" />
      <div class="flex flex-col gap-2">
        <button type="button"
          class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
          @click="clearHistory">
          <div class="min-w-0">
            <p class="text-sm text-fg">Очистить историю</p>
            <p class="text-xs text-fg-muted">Удалить все записи о воспроизведении</p>
          </div>
        </button>
        <button type="button"
          class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
          @click="clearDislikes">
          <div class="min-w-0">
            <p class="text-sm text-fg">Очистить дизлайки</p>
            <p class="text-xs text-fg-muted">Удалить все скрытые треки</p>
          </div>
        </button>
        <button type="button"
          class="flex items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg"
          @click="clearMetadataCache">
          <div class="min-w-0">
            <p class="text-sm text-fg">Очистить кэш метаданных</p>
            <p class="text-xs text-fg-muted">Найденные обложки и метаданные будут забыты</p>
          </div>
        </button>
      </div>
    </section>

    <section>
      <SectionTitle text="Опасная зона" />
      <button type="button"
        class="flex w-full items-center justify-between gap-4 bg-red-500/10 px-4 py-3 text-left transition hover:bg-red-500/15"
        @click="resetAll">
        <div class="min-w-0">
          <p class="text-sm text-red-400">Сбросить все данные</p>
          <p class="text-xs text-red-400/70">
            Библиотека, плейлисты, история, настройки. Необратимо.
          </p>
        </div>
      </button>
    </section>
  </div>
</template>
