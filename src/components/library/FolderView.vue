<!-- src/components/library/FolderView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import Breadcrumbs from './Breadcrumbs.vue'
import FolderList from './FolderList.vue'
import TrackList from './TrackList.vue'

const library = useLibraryStore()
const player = usePlayerStore()
const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)

// LibraryTrack extends Track, так что приведение бесплатное
const tracks = computed(() => currentTracks.value)

const hasTracks = computed(() => tracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

function onSelectTrack(index: number) {
  player.setQueue(tracks.value, index)
}

function playAll() {
  if (tracks.value.length === 0) return
  player.setQueue(tracks.value, 0)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка: breadcrumbs + счётчики + «Играть всё» -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3"
    >
      <Breadcrumbs />

      <div class="flex shrink-0 items-center gap-3">
        <span v-if="currentFolder" class="text-xs text-zinc-500">
          <template v-if="hasFolders">{{ currentSubfolders.length }} папок</template>
          <template v-if="hasFolders && hasTracks"> · </template>
          <template v-if="hasTracks">{{ tracks.length }} треков</template>
          <template v-if="!hasFolders && !hasTracks">пусто</template>
        </span>

        <button
          v-if="hasTracks"
          type="button"
          class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
          @click="playAll"
        >
          Играть всё
        </button>
      </div>
    </div>

    <!-- Папки: свой скролл, не более 40% высоты -->
    <div
      v-if="hasFolders"
      class="shrink-0 overflow-y-auto border-b border-zinc-800"
      :class="hasTracks ? 'max-h-[40%]' : 'flex-1'"
    >
      <FolderList />
    </div>

    <!-- Треки: занимают оставшееся место, свой скролл внутри TrackList.
         min-h-0 критично — без него flex-элемент не сожмётся ниже контента,
         и внутренний overflow-y-auto не заработает -->
    <div v-if="hasTracks" class="min-h-0 flex-1">
      <TrackList :key="currentFolder?.id" :tracks="tracks" @select="onSelectTrack" />
    </div>

    <!-- Заглушка, если в папке ничего нет -->
    <div
      v-else-if="!hasFolders"
      class="flex flex-1 items-center justify-center text-sm text-zinc-500"
    >
      В этой папке пусто
    </div>
  </div>
</template>
