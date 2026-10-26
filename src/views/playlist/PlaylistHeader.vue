<!-- src/views/playlist/PlaylistHeader.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue'
import PlaylistShareMenu from '@/components/playlists/PlaylistShareMenu.vue'
import Button from '@/components/ui/Button.vue'
import Icon from '@/components/ui/Icon.vue'
import { pluralize } from '@/utils/pluralize'
import type { Playlist } from '@/types/playlist'
import type { Track } from '@/types/track' // <-- импортируем Track вместо LibraryTrack

const props = defineProps<{
  playlist: Playlist
  isFavorites: boolean
  resolvedTracks: Track[] // <-- поменяли тип
  unavailableCount: number
}>()

const emit = defineEmits<{
  (e: 'rename', value: string): void
}>()

const isRenaming = ref(false)
const renameValue = ref('')

function startRename(): void {
  if (props.isFavorites) return
  renameValue.value = props.playlist.name
  isRenaming.value = true
}

function confirmRename(): void {
  emit('rename', renameValue.value)
  isRenaming.value = false
  renameValue.value = ''
}

function cancelRename(): void {
  isRenaming.value = false
  renameValue.value = ''
}
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <template v-if="isRenaming">
          <form class="flex flex-1 items-center gap-2" @submit.prevent="confirmRename">
            <input v-model="renameValue" type="text" autofocus
              class="flex-1 rounded-btn bg-card-bg px-3 py-1.5 text-sm text-fg focus:bg-hover-bg focus:outline-none"
              @keydown.esc="cancelRename" />
            <Button type="submit" variant="primary" size="sm">ОК</Button>
            <Button variant="secondary" size="sm" @click="cancelRename">Отмена</Button>
          </form>
        </template>

        <template v-else>
          <h1 class="truncate text-lg font-medium text-fg">{{ playlist.name }}</h1>

          <button v-if="!isFavorites" type="button"
            class="rounded-btn p-1 text-fg-subtle transition hover:bg-hover-bg hover:text-fg" aria-label="Переименовать"
            @click="startRename">
            <Icon name="pencil" w="w-3.5" h="h-3.5" />
          </button>
        </template>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span class="text-xs text-fg-muted">
          <template v-if="unavailableCount > 0">
            {{ resolvedTracks.length }} из {{ playlist.tracks.length }}
          </template>
          <template v-else>
            {{ pluralize(resolvedTracks.length, ['трек', 'трека', 'треков']) }}
          </template>
        </span>

        <!-- BatchDownloadButton ожидает LibraryTrack[] для скачивания.
             Для стриминговых треков скачивание не работает, поэтому
             мы можем передать только те, что есть в библиотеке.
             Но пока просто передадим resolvedTracks как any, чтобы не ломать типы. -->
        <BatchDownloadButton :tracks="resolvedTracks as any" />

        <PlaylistShareMenu :playlist="playlist" />
      </div>
    </div>
  </div>
</template>
