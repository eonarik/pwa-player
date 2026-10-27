<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useHistoryStore } from '@/stores/history'
import { useLibraryStore } from '@/stores/library'
import { pluralize } from '@/utils/pluralize'
import { formatRelativeTime } from '@/utils/formatRelativeTime'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import TrackListPage from '@/components/library/TrackListPage.vue'
import type { LibraryTrack } from '@/types/library'

const history = useHistoryStore()
const library = useLibraryStore()

const { uniqueHistory, sortedHistory, isEmpty } = storeToRefs(history)

const showUniqueOnly = ref(true)

// Выбираем, какие записи передать
const activeEntries = computed(() => {
  return showUniqueOnly.value ? uniqueHistory.value : sortedHistory.value
})

// Получаем треки из библиотеки
const tracks = computed<LibraryTrack[]>(() => {
  return activeEntries.value
    .map((e) => library.getTrack(e.trackId))
    .filter((t): t is LibraryTrack => Boolean(t))
})

function clearHistory() {
  const confirmed = window.confirm('Очистить всю историю воспроизведения?')
  if (!confirmed) return
  history.clear()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="История" :subtitle="pluralize(tracks.length, ['запись', 'записи', 'записей'])">
      <ShowSourceCheckbox />

      <div class="flex items-center gap-1 rounded-btn bg-card-bg p-0.5">
        <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
          :class="showUniqueOnly ? 'bg-bg-elevated text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
          @click="showUniqueOnly = true">
          Уникальные
        </button>
        <button type="button" class="rounded-btn px-2 py-1 text-xs transition"
          :class="!showUniqueOnly ? 'bg-bg-elevated text-fg shadow-sm' : 'text-fg-muted hover:text-fg'"
          @click="showUniqueOnly = false">
          Все
        </button>
      </div>

      <Button v-if="!isEmpty" variant="danger" size="sm" @click="clearHistory">Очистить</Button>
    </PageHeader>

    <TrackListPage title="" :tracks="tracks" :is-snapshot="false" :show-search="true" :show-filter="true"
      :show-play-all="true" :show-batch-add="true">

      <template #track-meta="{ track }">
        <span v-if="activeEntries.find(e => e.trackId === track.id)"
          class="mr-2 text-[10px] tabular-nums text-fg-subtle">
          {{formatRelativeTime(activeEntries.find(e => e.trackId === track.id)!.playedAt)}}
        </span>
      </template>
    </TrackListPage>
  </div>
</template>
