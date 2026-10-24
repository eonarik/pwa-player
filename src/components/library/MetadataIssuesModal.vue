<!-- src/components/library/MetadataIssuesModal.vue -->
<script setup lang="ts">
import { reactive } from 'vue'
import { metadataApplier } from '@/services/metadata/MetadataApplier'
import ModalLayout from '@/components/ui/ModalLayout.vue'
import Button from '@/components/ui/Button.vue'
import type { MetadataIssue } from '@/composables/useMetadataSearch'

const props = defineProps<{
  issues: MetadataIssue[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

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

function candidateLabel(c: {
  artist: string
  title: string
  album: string
  source: string
  similarity: number
}): string {
  const parts = [c.artist, c.title].filter(Boolean).join(' — ')
  return `${parts} · ${c.album} · ${c.source} · ${formatSimilarity(c.similarity)}`
}

function apply() {
  for (const issue of props.issues) {
    const index = selection.get(issue.track.id)
    if (index === undefined || index === -1) continue

    const candidate = issue.candidates[index]
    if (!candidate) continue

    metadataApplier.applyCandidate(issue.track, candidate)
  }
  emit('close')
}

function ignore() {
  emit('close')
}
</script>

<template>
  <ModalLayout title="Проблемные треки" max-width="lg" @close="ignore">
    <p class="mb-4 text-xs text-fg-muted">
      Для треков ниже найдены варианты. Выберите подходящий или пропустите.
    </p>

    <div class="flex flex-col gap-4">
      <div v-for="issue in issues" :key="issue.track.id"
        class="border-b border-hover-bg pb-4 last:border-b-0 last:pb-0">
        <p class="mb-2 truncate text-sm text-fg-muted">
          <span class="text-fg-subtle">Оригинал:</span>
          {{ [issue.track.artist, issue.track.title].filter(Boolean).join(' — ') }}
        </p>

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

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="ignore">Закрыть</Button>
        <Button variant="primary" @click="apply">Применить</Button>
      </div>
    </template>
  </ModalLayout>
</template>
