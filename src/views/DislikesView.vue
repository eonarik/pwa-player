<!-- src/views/DislikesView.vue -->

<!-- DislikesView.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDislikesStore } from '@/stores/dislikes';
import { useLibraryStore } from '@/stores/library';
import { pluralize } from '@/utils/pluralize';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import PageHeader from '@/components/ui/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue';
import TrackListPage from '@/components/library/TrackListPage.vue';
import type { Track } from '@/types/track';

const dislikes = useDislikesStore();
const library = useLibraryStore();
const { sortedEntries } = storeToRefs(dislikes);

const tracks = computed<Track[]>(() => {
  return sortedEntries.value.map((e) => library.getTrack(e.trackId)).filter((t): t is Track => Boolean(t));
});

const isEmpty = computed(() => tracks.value.length === 0);

function getDislikedAt(trackId: string): number | null {
  return dislikes.dislikes.dislikedAt[trackId as never] ?? null;
}

function clearDislikes() {
  const confirmed = window.confirm('Очистить список дизлайков?');
  if (!confirmed) return;
  dislikes.clear();
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Дизлайки" :subtitle="pluralize(tracks.length, ['трек', 'трека', 'треков'])">
      <ShowSourceCheckbox />
      <Button v-if="!isEmpty" variant="danger" size="sm" @click="clearDislikes">Очистить</Button>
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
        <span v-if="getDislikedAt(track.id) !== null" class="mr-2 text-[10px] tabular-nums text-fg-subtle">
          {{ formatRelativeTime(getDislikedAt(track.id)!) }}
        </span>
      </template>
    </TrackListPage>
  </div>
</template>
