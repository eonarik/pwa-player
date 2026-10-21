<!-- src/views/settings/SettingsData.vue -->
<script setup lang="ts">
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { schemaService } from '@/services/persistence/SchemaService'
import { toastService } from '@/services/ui/ToastService'
import { yandexSelfService } from '@/plugins/yandexSelf/YandexSelfService'

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

async function resetAll(): Promise<void> {
  if (!window.confirm('Сбросить все данные приложения? Действие необратимо.')) return
  yandexSelfService.logout()
  await schemaService.clearAll()
  location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">Очистка</h2>
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
      <h2 class="mb-2 text-xs font-medium uppercase tracking-wider text-fg-subtle">
        Опасная зона
      </h2>
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
