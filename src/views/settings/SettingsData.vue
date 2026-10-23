<!-- src/views/settings/SettingsData.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { schemaService } from '@/services/persistence/SchemaService'
import { backupService, type BackupDomain } from '@/services/backup/BackupService'
import { toastService } from '@/services/ui/ToastService'
import { yandexSelfService } from '@/plugins/yandexSelf/YandexSelfService'
import { downloadTextFile } from '@/utils/downloadFile'
import SectionTitle from '@/components/ui/SectionTitle.vue'

const history = useHistoryStore()
const dislikes = useDislikesStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isExporting = ref(false)
const isImporting = ref(false)

// Общий выбор доменов для экспорта и импорта
const selectedDomains = ref<BackupDomain[]>(['media', 'sources', 'settings'])

// --- Очистка --------------------------------------------------------

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

// --- Экспорт / импорт -----------------------------------------------

async function exportBackup(): Promise<void> {
  if (isExporting.value) return
  if (selectedDomains.value.length === 0) {
    toastService.error('Выберите, что скачать')
    return
  }
  isExporting.value = true
  try {
    const backup = await backupService.exportAll(selectedDomains.value)
    const filename = `cuei-backup-${backup.exportedAt.slice(0, 10)}.json`
    downloadTextFile(filename, JSON.stringify(backup, null, 2), 'application/json')
    toastService.success('Бэкап скачан')
  } catch (err) {
    console.error('[settings] export failed', err)
    toastService.error('Не удалось создать бэкап')
  } finally {
    isExporting.value = false
  }
}

function triggerImport(): void {
  if (selectedDomains.value.length === 0) {
    toastService.error('Выберите, что импортировать')
    return
  }
  fileInputRef.value?.click()
}

async function onFileSelected(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!window.confirm('Импорт перезапишет выбранные разделы. Продолжить?')) {
    target.value = ''
    return
  }

  isImporting.value = true
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    await backupService.importAll(parsed, selectedDomains.value)
  } catch (err) {
    console.error('[settings] import failed', err)
    toastService.error(err instanceof Error ? err.message : 'Не удалось импортировать бэкап')
  } finally {
    isImporting.value = false
    target.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <SectionTitle text="Резервная копия" />
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-3 bg-card-bg px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm text-fg">Разделы</p>
            <p class="text-xs text-fg-muted">
              Будут включены в бэкап или перезаписаны при импорте
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input v-model="selectedDomains" type="checkbox" value="media" class="h-4 w-4 accent-active" />
              Медиа (плейлисты, история, дизлайки)
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input v-model="selectedDomains" type="checkbox" value="sources" class="h-4 w-4 accent-active" />
              Источники (радио, подкасты)
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <input v-model="selectedDomains" type="checkbox" value="settings" class="h-4 w-4 accent-active" />
              Настройки и плагины
            </label>
          </div>

          <div class="mt-2 flex flex-col gap-2 sm:flex-row">
            <button type="button"
              class="flex-1 rounded-btn bg-card-bg px-4 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isExporting || selectedDomains.length === 0" @click="exportBackup">
              {{ isExporting ? 'Скачивание…' : 'Скачать бэкап' }}
            </button>

            <button type="button"
              class="flex-1 rounded-btn bg-card-bg px-4 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isImporting || selectedDomains.length === 0" @click="triggerImport">
              {{ isImporting ? 'Импорт…' : 'Импортировать бэкап' }}
            </button>
          </div>
        </div>

        <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="onFileSelected" />
      </div>
    </section>

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
