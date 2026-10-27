<!-- src/views/QueueView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { pluralize } from '@/utils/pluralize'
import QueueTrackRow from '@/components/queue/QueueTrackRow.vue'
import BatchAddToPlaylistButton from '@/components/library/BatchAddToPlaylistButton.vue' // <-- импорт
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'

const player = usePlayerStore()
const { queue, currentIndex, currentTrack, isPlaying } = storeToRefs(player)
const hasQueue = computed(() => queue.value.length > 0)

function playAt(index: number): void {
  player.playAt(index)
}

function removeAt(index: number): void {
  player.removeFromQueue(index)
}

function clearQueue(): void {
  const confirmed = window.confirm('Очистить очередь воспроизведения?')
  if (!confirmed) return
  player.clearQueue()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Очередь" :subtitle="hasQueue
      ? `${pluralize(queue.length, ['трек', 'трека', 'треков'])}${currentTrack ? ` · играет ${currentIndex + 1}-й` : ''}`
      : 'пусто'
      ">

      <BatchAddToPlaylistButton :tracks="queue" />

      <FolderSettingsMenu />
      <Button v-if="hasQueue" variant="danger" size="sm" @click="clearQueue">
        Очистить
      </Button>
    </PageHeader>

    <div v-if="!hasQueue" class="flex flex-1 items-center justify-center p-6 h-full">
      <EmptyState title="Очередь пуста" description="Запустите трек или папку — они появятся здесь">
        <template #icon>
          <Icon name="list" w="w-10" h="h-10" />
        </template>
      </EmptyState>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <ListContainer>
        <QueueTrackRow v-for="(track, index) in queue" :key="`${track.id}-${index}`" :track="track" :index="index"
          :is-current="index === currentIndex" :is-playing="isPlaying" @select="playAt(index)"
          @remove="removeAt(index)" />
      </ListContainer>
    </div>
  </div>
</template>
