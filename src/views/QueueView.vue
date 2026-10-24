<!-- src/views/QueueView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { usePlaylistsStore } from '@/stores/playlists'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { toastService } from '@/services/ui/ToastService'
import { pluralize } from '@/utils/pluralize'
import QueueTrackRow from '@/components/queue/QueueTrackRow.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'

const player = usePlayerStore()
const playlists = usePlaylistsStore()

const { queue, currentIndex, currentTrack, isPlaying } = storeToRefs(player)

const hasQueue = computed(() => queue.value.length > 0)

const userPlaylists = computed(() =>
  playlists.sortedPlaylists.filter((p) => p.id !== FAVORITES_PLAYLIST_ID),
)

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

function saveAllToPlaylist(playlistId: string | null, close: () => void): void {
  if (queue.value.length === 0) {
    close()
    return
  }

  let targetId = playlistId
  if (!targetId) {
    const defaultName = `Очередь ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
    targetId = playlists.createPlaylist(defaultName)
  }

  const added = playlists.addTracksToPlaylist(targetId, queue.value)
  const playlist = playlists.getPlaylist(targetId)

  if (added > 0) {
    toastService.success(
      `Добавлено в «${playlist?.name ?? 'плейлист'}»: ${added} ${pluralize(added, ['трек', 'трека', 'треков'])}`,
    )
  } else {
    toastService.info('Все треки уже в плейлисте')
  }

  close()
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Очередь" :subtitle="hasQueue
      ? `${pluralize(queue.length, ['трек', 'трека', 'треков'])}${currentTrack ? ` · играет ${currentIndex + 1}-й` : ''}`
      : 'пусто'
      ">
      <FolderSettingsMenu />

      <DropdownMenu v-if="hasQueue" :width="256" align="right">
        <template #trigger="{ toggle, setTriggerRef }">
          <div :ref="setTriggerRef" @click.stop="toggle">
            <Button variant="secondary" size="sm">В плейлист</Button>
          </div>
        </template>
        <template #default="{ close }">
          <button v-for="p in userPlaylists" :key="p.id" type="button"
            class="block w-full truncate px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
            @click="saveAllToPlaylist(p.id, close)">
            {{ p.name }}
          </button>
          <button type="button"
            class="block w-full px-4 py-2.5 text-left text-sm text-active transition hover:bg-hover-bg"
            @click="saveAllToPlaylist(null, close)">
            + Создать новый
          </button>
        </template>
      </DropdownMenu>

      <Button v-if="hasQueue" variant="danger" size="sm" @click="clearQueue">
        Очистить
      </Button>
    </PageHeader>

    <div v-if="!hasQueue" class="flex flex-1">
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
