<!-- src/views/QueueView.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { pluralize } from '@/utils/pluralize';
import TrackListPage from '@/components/library/TrackListPage.vue';
import TrackActions from '@/components/library/TrackActions.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import type { Track } from '@/types/track';

const player = usePlayerStore();
const { queue } = storeToRefs(player);

const hasQueue = computed(() => queue.value.length > 0);

const subtitle = computed(() => {
  if (!hasQueue.value) return '';
  return pluralize(queue.value.length, ['трек', 'трека', 'треков']);
});

function playAt(index: number): void {
  player.playAt(index);
}

function removeAt(index: number): void {
  player.removeFromQueue(index);
}

function clearQueue(): void {
  const confirmed = window.confirm('Очистить очередь воспроизведения?');
  if (!confirmed) return;
  player.clearQueue();
}

function itemKey(track: Track, index: number): string {
  return `${track.id}-${index}`;
}
</script>

<template>
  <TrackListPage
    title="Очередь"
    :subtitle="subtitle"
    :tracks="queue"
    :show-search="false"
    :show-filter="true"
    :show-play-all="false"
    :show-batch-add="true"
    :custom-select="true"
    :item-key="itemKey"
    @select-track="playAt"
  >
    <template #header-actions>
      <Button v-if="hasQueue" variant="danger" size="sm" @click="clearQueue"> Очистить </Button>
    </template>

    <template #track-actions="{ track, index }">
      <TrackActions :track="track" :queue-index="index" @removed-from-queue="removeAt(index)" />
    </template>

    <template #empty>
      <EmptyState title="Очередь пуста" description="Запустите трек или папку — они появятся здесь">
        <template #icon>
          <Icon name="list" w="w-10" h="w-10" />
        </template>
      </EmptyState>
    </template>
  </TrackListPage>
</template>
