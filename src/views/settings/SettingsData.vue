<!-- src/views/settings/SettingsData.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useDislikesStore } from '@/stores/dislikes'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { schemaService } from '@/services/persistence/SchemaService'
import { backupService, type BackupDomain } from '@/services/backup/BackupService'
import { toastService } from '@/services/ui/ToastService'
import { yandexSelfService } from '@/plugins/yandexSelf/YandexSelfService'
import { downloadTextFile } from '@/utils/downloadFile'
import SectionTitle from '@/components/ui/SectionTitle.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Button from '@/components/ui/Button.vue'
import SettingsActionRow from '@/components/ui/SettingsActionRow.vue'

const history = useHistoryStore()
const dislikes = useDislikesStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isExporting = ref(false)
const isImporting = ref(false)

// Чекбоксы для доменов
const checkMedia = ref(true)
const checkSources = ref(true)
const checkSettings = ref(true)

const selectedDomains = computed<BackupDomain[]>(() => {
  const list: BackupDomain[] = []
  if (checkMedia.value) list.push('media')
  if (checkSources.value) list.push('sources')
  if (checkSettings.value) list.push('settings')
  return list
})

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
            <p class="text-xs text-fg-muted">Будут включены в бэкап или перезаписаны при импорте</p>
          </div>

          <div class="flex flex-col gap-1">
            <Checkbox v-model="checkMedia" label="Медиа (плейлисты, история, дизлайки)" />
            <Checkbox v-model="checkSources" label="Источники (радио, подкасты)" />
            <Checkbox v-model="checkSettings" label="Настройки и плагины" />
          </div>

          <div class="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" class="flex-1" :disabled="isExporting || selectedDomains.length === 0"
              @click="exportBackup">
              {{ isExporting ? 'Скачивание…' : 'Скачать бэкап' }}
            </Button>

            <Button variant="primary" class="flex-1" :disabled="isImporting || selectedDomains.length === 0"
              @click="triggerImport">
              {{ isImporting ? 'Импорт…' : 'Импортировать бэкап' }}
            </Button>
          </div>
        </div>

        <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="onFileSelected" />
      </div>
    </section>

    <section>
      <SectionTitle text="Очистка" />
      <div class="flex flex-col gap-2">
        <SettingsActionRow title="Очистить историю" description="Удалить все записи о воспроизведении"
          @click="clearHistory" />
        <SettingsActionRow title="Очистить дизлайки" description="Удалить все скрытые треки" @click="clearDislikes" />
        <SettingsActionRow title="Очистить кэш метаданных" description="Найденные обложки и метаданные будут забыты"
          @click="clearMetadataCache" />
      </div>
    </section>

    <section>
      <SectionTitle text="Опасная зона" />
      <SettingsActionRow variant="danger" title="Сбросить все данные"
        description="Библиотека, плейлисты, история, настройки. Необратимо." @click="resetAll" />
    </section>
  </div>
</template>
