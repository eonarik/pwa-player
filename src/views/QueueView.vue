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
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue' // <-- Добавлено

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
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <h1 class="text-lg font-medium text-fg">Очередь</h1>
        <p class="text-xs text-fg-muted">
          <template v-if="hasQueue">
            {{ pluralize(queue.length, ['трек', 'трека', 'треков']) }}
            <template v-if="currentTrack"> · играет {{ currentIndex + 1 }}-й</template>
          </template>
          <template v-else>пусто</template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <FolderSettingsMenu /> <!-- <-- Добавлено -->

        <DropdownMenu v-if="hasQueue" :width="256" align="right">
          <template #trigger="{ toggle, setTriggerRef }">
            <button :ref="setTriggerRef" type="button"
              class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
              @click.stop="toggle">
              В плейлист
            </button>
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

        <button v-if="hasQueue" type="button"
          class="rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-red-500/10 hover:text-red-400"
          @click="clearQueue">
          Очистить
        </button>
      </div>
    </div>

    <!-- Пусто -->
    <div v-if="!hasQueue" class="flex flex-1 items-center justify-center text-sm text-fg-muted">
      Очередь пуста. Запустите трек или папку — они появятся здесь.
    </div>

    <!-- Список -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-0.5 p-2">
        <QueueTrackRow v-for="(track, index) in queue" :key="`${track.id}-${index}`" :track="track" :index="index"
          :is-current="index === currentIndex" :is-playing="isPlaying" @select="playAt(index)"
          @remove="removeAt(index)" />
      </div>
    </div>
  </div>
</template>
