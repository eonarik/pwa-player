<!-- src/views/HistoryView.vue -->

<!-- HistoryView.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useHistoryStore } from '@/stores/history';
import { useLibraryStore } from '@/stores/library';
import { pluralize } from '@/utils/pluralize';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import PageHeader from '@/components/ui/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue';
import TrackListPage from '@/components/library/TrackListPage.vue';
import type { Track } from '@/types/track';

const history = useHistoryStore();
const library = useLibraryStore();

const { uniqueHistory, isEmpty } = storeToRefs(history);

const tracks = computed<Track[]>(() => {
  return uniqueHistory.value.map((e) => library.getTrack(e.trackId)).filter((t): t is Track => Boolean(t));
});

function getPlayedAt(trackId: string): number | null {
  return history.history.playedAt[trackId as never] ?? null;
}

function clearHistory() {
  const confirmed = window.confirm('Очистить всю историю воспроизведения?');
  if (!confirmed) return;
  history.clear();
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="История" :subtitle="pluralize(tracks.length, ['запись', 'записи', 'записей'])">
      <ShowSourceCheckbox />
      <Button v-if="!isEmpty" variant="danger" size="sm" @click="clearHistory">Очистить</Button>
    </PageHeader>

    <TrackListPage
      title=""
      :tracks="tracks"
      :show-search="true"
      :show-filter="true"
      :show-play-all="true"
      :show-batch-add="true"
    >
      <template #track-meta="{ track }">
        <span v-if="getPlayedAt(track.id) !== null" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
          {{ formatRelativeTime(getPlayedAt(track.id)!) }}
        </span>
      </template>
    </TrackListPage>
  </div>
</template>
