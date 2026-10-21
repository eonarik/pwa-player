<!-- src/views/folder/FolderContent.vue -->
<script setup lang="ts">
import FolderList from '@/components/library/FolderList.vue'
import TrackList from '@/components/library/TrackList.vue'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import FileListItem from '@/components/library/FileListItem.vue'
import MarkdownText from '@/components/ui/MarkdownText.vue'
import type { ArtistGroup } from '@/composables/useLibrarySearch'
import type { LibraryTrack, TextFileRef } from '@/types/library'

const props = defineProps<{
  hasFolders: boolean
  hasTextFiles: boolean
  hasTracks: boolean
  textFiles: TextFileRef[]
  tracks: LibraryTrack[]
  emptyStateMessage: string | null
  currentFolderId: string | null
  isScanning: boolean

  // Поиск
  hasQuery: boolean
  hasResults: boolean
  searchFlatTracks: LibraryTrack[]
  groups: ArtistGroup[]
  isPlaying: boolean
  currentTrackId: string | null
}>()

const emit = defineEmits<{
  (e: 'select-track', index: number): void
  (e: 'select-search-track', trackId: string): void
  (e: 'open-file', file: TextFileRef): void
  (e: 'play-search-all'): void
}>()

function isSearchCurrent(trackId: string): boolean {
  return props.currentTrackId === trackId
}
</script>

<template>
  <!-- Режим поиска -->
  <div v-if="hasQuery" class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl p-2">
      <div v-if="!hasResults" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
        Ничего не найдено
      </div>

      <div v-else class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-3 px-3 py-1">
          <span class="text-xs text-fg-muted">
            Найдено: {{ searchFlatTracks.length }} · Групп: {{ groups.length }}
          </span>

          <button type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="emit('play-search-all')">
            Играть всё
          </button>
        </div>

        <div v-for="group in groups" :key="group.artist">
          <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            {{ group.artist }}
          </p>

          <div class="flex flex-col gap-0.5">
            <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
              :index="searchFlatTracks.findIndex((t) => t.id === track.id)" :is-current="isSearchCurrent(track.id)"
              :is-playing="isPlaying" @select="() => emit('select-search-track', track.id)">
              <template #actions>
                <TrackActions :track="track" />
              </template>
            </TrackListItem>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Обычный режим -->
  <div v-else class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl">
      <div v-if="hasFolders" class="pb-2 -ml-2 -mr-2">
        <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Папки
        </p>
        <FolderList />
      </div>

      <div v-if="hasTextFiles" class="pb-4">
        <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Файлы
        </p>
        <div class="flex flex-col gap-0.5">
          <FileListItem v-for="file in textFiles" :key="file.path" :file="file" @open="emit('open-file', file)" />
        </div>
      </div>

      <div v-if="hasTracks" class="pb-4">
        <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
          Треки
        </p>
        <TrackList :key="currentFolderId ?? 'no-folder'" :tracks="tracks"
          @select="(i: number) => emit('select-track', i)" />
      </div>

      <div v-if="!hasFolders && !hasTracks && !hasTextFiles"
        class="flex h-full items-center justify-center px-6 py-20 text-center text-sm text-fg-muted">
        <MarkdownText v-if="emptyStateMessage" :source="emptyStateMessage" />
        <span v-else>В этой папке пусто</span>
      </div>
    </div>
  </div>
</template>
