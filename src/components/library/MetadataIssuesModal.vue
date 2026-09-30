<!-- src/components/library/MetadataIssuesModal.vue -->
<script setup lang="ts">
import { reactive } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import type { OriginalMetadata } from '@/services/persistence/MetadataPersistenceService'
import type { LibraryTrack } from '@/types/library'
import type { MetadataIssue } from '@/composables/useMetadataSearch'
import type { MetadataCandidate } from "@/services/metadata/TrackMetadataService"

const props = defineProps<{
  issues: MetadataIssue[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const library = useLibraryStore()

/**
 * Выбор: trackId → index кандидата.
 * -1 = пропустить.
 * Не задан → пропустить.
 */
const selection = reactive(new Map<string, number>())

function onSelect(trackId: string, value: string) {
  selection.set(trackId, Number(value))
}

function currentValue(trackId: string): string {
  const v = selection.get(trackId)
  return v === undefined ? '-1' : String(v)
}

function formatSimilarity(s: number): string {
  return `${Math.round(s * 100)}%`
}

function candidateLabel(c: MetadataCandidate): string {
  const parts = [c.artist, c.title].filter(Boolean).join(' — ')
  return `${parts} · ${c.album} · ${c.source} · ${formatSimilarity(c.similarity)}`
}

function apply() {
  for (const issue of props.issues) {
    const index = selection.get(issue.track.id)
    if (index === undefined || index === -1) continue

    const incoming = issue.candidates[index]
    if (!incoming) continue

    const track = issue.track
    const patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>> = {}
    const artist = track.artist?.trim() ?? ''

    if (!artist || artist === 'Yandex Disk') {
      if (incoming.artist) patch.artist = incoming.artist
    }
    if (incoming.title) patch.title = incoming.title
    if (incoming.album) patch.album = incoming.album
    if (!track.coverUrl && incoming.coverUrl) patch.coverUrl = incoming.coverUrl

    const original: OriginalMetadata = {
      artist: track.artist ?? '',
      title: track.title,
      album: track.album ?? '',
      coverUrl: track.coverUrl,
      coverUrlWasBlob: track.coverUrl?.startsWith('blob:') ?? false,
    }
    const existing = metadataPersistenceService.get(track.id)
    metadataPersistenceService.setInMemory(track.id, {
      artist: existing?.artist ?? incoming.artist,
      title: existing?.title ?? incoming.title,
      album: existing?.album ?? incoming.album,
      coverUrl: existing?.coverUrl ?? incoming.coverUrl,
      similarity: existing?.similarity ?? incoming.similarity,
      original: existing?.original ?? original,
    })
    void metadataPersistenceService.flush()

    if (Object.keys(patch).length > 0) {
      library.updateTrackMetadata(track.id, patch)
    }
  }
  emit('close')
}

function ignore() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4" @click.self="ignore">
      <div class="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden bg-bg-elevated shadow-xl">
        <!-- Шапка -->
        <div class="flex shrink-0 items-center justify-between px-5 py-4">
          <h2 class="text-lg font-medium text-fg">Проблемные треки</h2>
          <button type="button" class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            aria-label="Закрыть" @click="ignore">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-y-auto px-5 pb-4">
          <p class="mb-3 text-xs text-fg-muted">
            Для треков ниже найдены варианты. Выберите подходящий или пропустите.
          </p>

          <div class="flex flex-col gap-3">
            <div v-for="issue in issues" :key="issue.track.id" class="border-b border-hover-bg pb-3 last:border-b-0">
              <!-- Текущее -->
              <p class="mb-2 truncate text-sm text-fg-muted">
                <span class="text-fg-subtle">Оригинал:</span>
                {{ [issue.track.artist, issue.track.title].filter(Boolean).join(' — ') }}
              </p>

              <!-- Выбор кандидата -->
              <select :value="currentValue(issue.track.id)"
                class="w-full rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg focus:outline-none"
                @change="onSelect(issue.track.id, ($event.target as HTMLSelectElement).value)">
                <option value="-1" class="bg-bg-elevated text-fg-muted">Пропустить</option>
                <option v-for="(candidate, index) in issue.candidates" :key="index" :value="String(index)"
                  class="bg-bg-elevated text-fg">
                  {{ candidateLabel(candidate) }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Кнопки -->
        <div class="flex shrink-0 items-center justify-end gap-2 px-5 py-4">
          <button type="button" class="rounded-btn px-4 py-2 text-sm text-fg-muted transition hover:text-fg"
            @click="ignore">
            Закрыть
          </button>
          <button type="button"
            class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
            @click="apply">
            Применить
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
