<!-- src/components/library/SyncIssuesModal.vue -->
<script setup lang="ts">
import { computed, reactive } from 'vue'
import { syncService } from '@/services/download/SyncService'
import { useLibraryStore } from '@/stores/library'
import type { SelectedIssues } from '@/services/download/types'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const library = useLibraryStore()

/** Отмеченные элементы: ключи — `${pluginId}:${relativePath}` и trackId */
const selected = reactive({
  onlyLocal: new Set<string>(),
  missing: new Set<string>(),
})

// Предзаполняем: всё отмечено
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
  // Простая эвристика: 'yandex' → 'Яндекс.Диск', 'local' → 'Локальная папка'
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
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" @click.self="ignore">
      <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <!-- Шапка -->
        <div class="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 class="text-lg font-medium text-zinc-100">Обновление с устройства</h2>
          <button type="button" class="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Закрыть" @click="ignore">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div v-for="issue in issues" :key="issue.pluginId" class="mb-6 last:mb-0">
            <p class="mb-3 text-xs uppercase tracking-wider text-zinc-500">
              {{ pluginName(issue.pluginId) }}
            </p>

            <!-- Новые файлы -->
            <div v-if="issue.onlyLocal.length > 0" class="mb-4">
              <p class="mb-2 text-sm text-zinc-300">
                Найдены новые треки, добавить в источник?
              </p>
              <div class="flex flex-col gap-1">
                <label v-for="item in issue.onlyLocal" :key="item.relativePath"
                  class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800/60">
                  <input type="checkbox" :checked="isOnlyLocalSelected(issue.pluginId, item.relativePath)"
                    class="h-4 w-4 shrink-0 cursor-pointer accent-active"
                    @change="toggleOnlyLocal(issue.pluginId, item.relativePath)" />
                  <span class="min-w-0 flex-1 truncate">{{ item.filename }}</span>
                  <span class="shrink-0 text-xs text-zinc-500">{{ item.relativePath }}</span>
                </label>
              </div>
            </div>

            <!-- Отсутствующие -->
            <div v-if="issue.missing.length > 0">
              <p class="mb-2 text-sm text-zinc-300">
                Следующие треки не найдены на устройстве. Пометить как «в облаке»?
              </p>
              <div class="flex flex-col gap-1">
                <label v-for="trackId in issue.missing" :key="trackId"
                  class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800/60">
                  <input type="checkbox" :checked="isMissingSelected(issue.pluginId, trackId)"
                    class="h-4 w-4 shrink-0 cursor-pointer accent-active"
                    @change="toggleMissing(issue.pluginId, trackId)" />
                  <span class="min-w-0 flex-1 truncate">{{ missingTrackTitle(trackId) }}</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="issues.length === 0" class="py-8 text-center text-sm text-zinc-500">
            Проблем не найдено
          </div>
        </div>

        <!-- Кнопки -->
        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button type="button" class="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
            @click="ignore">
            Проигнорировать
          </button>
          <button type="button"
            class="rounded-lg bg-active px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-active"
            @click="apply">
            Применить
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
