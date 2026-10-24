<!-- src/components/library/SyncIssuesModal.vue -->
<script setup lang="ts">
import { computed, reactive } from 'vue'
import { syncService } from '@/services/download/SyncService'
import { useLibraryStore } from '@/stores/library'
import ModalLayout from '@/components/ui/ModalLayout.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Button from '@/components/ui/Button.vue'
import type { SelectedIssues } from '@/services/download/types'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const library = useLibraryStore()

const selected = reactive({
  onlyLocal: new Set<string>(),
  missing: new Set<string>(),
})

for (const issue of syncService.issues.value) {
  for (const item of issue.onlyLocal) {
    selected.onlyLocal.add(`${issue.pluginId}:${item.relativePath}`)
  }
  for (const trackId of issue.missing) {
    selected.missing.add(`${issue.pluginId}:${trackId}`)
  }
}

const issues = computed(() => syncService.issues.value)

function toggleOnlyLocal(pluginId: string, relativePath: string) {
  const key = `${pluginId}:${relativePath}`
  if (selected.onlyLocal.has(key)) {
    selected.onlyLocal.delete(key)
  } else {
    selected.onlyLocal.add(key)
  }
}

function toggleMissing(pluginId: string, trackId: string) {
  const key = `${pluginId}:${trackId}`
  if (selected.missing.has(key)) {
    selected.missing.delete(key)
  } else {
    selected.missing.add(key)
  }
}

function isOnlyLocalSelected(pluginId: string, relativePath: string): boolean {
  return selected.onlyLocal.has(`${pluginId}:${relativePath}`)
}

function isMissingSelected(pluginId: string, trackId: string): boolean {
  return selected.missing.has(`${pluginId}:${trackId}`)
}

function pluginName(pluginId: string): string {
  if (pluginId === 'yandex') return 'Яндекс.Диск'
  if (pluginId === 'local') return 'Локальная папка'
  return pluginId
}

function missingTrackTitle(trackId: string): string {
  const track = library.getTrack(trackId)
  return track ? `${track.title} — ${track.artist}` : trackId
}

async function apply() {
  const selectedIssues: SelectedIssues = {
    onlyLocal: [],
    missing: [],
  }

  for (const issue of issues.value) {
    for (const item of issue.onlyLocal) {
      if (isOnlyLocalSelected(issue.pluginId, item.relativePath)) {
        selectedIssues.onlyLocal.push({
          pluginId: issue.pluginId,
          relativePath: item.relativePath,
          filename: item.filename,
        })
      }
    }
    for (const trackId of issue.missing) {
      if (isMissingSelected(issue.pluginId, trackId)) {
        selectedIssues.missing.push({
          pluginId: issue.pluginId,
          trackId,
        })
      }
    }
  }

  await syncService.resolveIssues(selectedIssues)
  emit('close')
}

function ignore() {
  syncService.dismissIssues()
  emit('close')
}
</script>

<template>
  <ModalLayout title="Обновление с устройства" max-width="lg" @close="ignore">
    <div class="flex flex-col gap-6">
      <div v-for="issue in issues" :key="issue.pluginId">
        <p class="mb-3 text-xs uppercase tracking-wider text-fg-subtle">
          {{ pluginName(issue.pluginId) }}
        </p>

        <div v-if="issue.onlyLocal.length > 0" class="mb-4">
          <p class="mb-2 text-sm text-fg">Найдены новые треки, добавить в источник?</p>
          <div class="flex flex-col gap-1">
            <div v-for="item in issue.onlyLocal" :key="item.relativePath" class="py-1">
              <Checkbox :model-value="isOnlyLocalSelected(issue.pluginId, item.relativePath)"
                @update:model-value="toggleOnlyLocal(issue.pluginId, item.relativePath)">
                <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span class="min-w-0 flex-1 truncate">{{ item.filename }}</span>
                  <span class="shrink-0 text-xs text-fg-muted">{{ item.relativePath }}</span>
                </div>
              </Checkbox>
            </div>
          </div>
        </div>

        <div v-if="issue.missing.length > 0">
          <p class="mb-2 text-sm text-fg">
            Следующие треки не найдены на устройстве. Пометить как «в облаке»?
          </p>
          <div class="flex flex-col gap-1">
            <div v-for="trackId in issue.missing" :key="trackId" class="py-1">
              <Checkbox :model-value="isMissingSelected(issue.pluginId, trackId)"
                @update:model-value="toggleMissing(issue.pluginId, trackId)">
                <span class="min-w-0 flex-1 truncate">{{ missingTrackTitle(trackId) }}</span>
              </Checkbox>
            </div>
          </div>
        </div>
      </div>

      <div v-if="issues.length === 0" class="py-8 text-center text-sm text-fg-muted">
        Проблем не найдено
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="ignore">Проигнорировать</Button>
        <Button variant="primary" @click="apply">Применить</Button>
      </div>
    </template>
  </ModalLayout>
</template>
