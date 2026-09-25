<!-- src/App.vue -->
<script setup lang="ts">
import { watchEffect, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaSession } from '@/composables/useMediaSession'
import { loadLastSource } from '@/services/persistence/lastSource'
import PlayerControls from '@/components/player/PlayerControls.vue'
import { usePlaylistsStore } from './stores/playlists'
import { useHistoryStore } from './stores/history'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const history = useHistoryStore()
const { currentTrack, isPlaying } = storeToRefs(player)

useKeyboardShortcuts({
  onToggle: () => player.toggle(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeekBy: (delta) => player.seekBy(delta),
  onVolumeBy: (delta) => player.setVolumeBy(delta),
  onVolumeUp: () => player.setVolumeBy(0.05),
  onVolumeDown: () => player.setVolumeBy(-0.05),
})

useMediaSession({
  currentTrack,
  isPlaying,
  onPlay: () => player.play(),
  onPause: () => player.pause(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeek: (t) => player.seek(t),
  onSeekBy: (d) => player.seekBy(d),
})

watchEffect(() => {
  const t = currentTrack.value
  document.title = t ? `${t.title} — ${t.artist}` : 'PWA Player'
})

function goHome() {
  router.push({ name: 'home' })
}

function goToRoot() {
  router.push({ name: 'folder', params: { path: [] } })
}

const playlists = usePlaylistsStore()

onMounted(async () => {
  await playlists.restore()
  await history.restore()

  const lastSource = await loadLastSource()
  console.info('[app] last source:', lastSource)

  let libraryRestored = false

  if (lastSource === 'yandex') {
    // Пробуем Яндекс.Диск из кэша
    libraryRestored = await library.restoreYandexFromCache()
    // Если кэша нет или он протух — фолбэк на локальную
    if (!libraryRestored) {
      libraryRestored = await library.restore()
    }
  } else if (lastSource === 'local') {
    libraryRestored = await library.restore()
  } else {
    // lastSource нет — пробуем локальную (на случай, если она есть в IDB)
    libraryRestored = await library.restore()
  }

  if (libraryRestored) {
    console.info('[app] library restored')
    // Редиректим на корень библиотеки только если мы на главной.
    // Если пользователь был в плейлисте или конкретной папке — оставляем как есть.
    if (router.currentRoute.value.name === 'home') {
      router.replace({ name: 'folder', params: { path: [] } })
    }
  }

  const playerRestored = await player.restore()
  if (playerRestored) console.log('[player] restored')
})

function goToPlaylists() {
  router.push({ name: 'playlists' })
}

function goToHistory() {
  router.push({ name: 'history' })
}
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-zinc-900 text-zinc-100">
    <header class="app-safe-top flex items-center gap-3 border-b border-zinc-800 p-3">
      <button
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        title="На главную (выбор папки)"
        @click="goHome"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
        </svg>
        <span class="hidden md:inline">Главная</span>
      </button>

      <button
        v-if="library.hasLibrary"
        type="button"
        class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        @click="goToRoot"
      >
        << <span class="hidden md:inline">К библиотеке</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:px-3"
        title="Плейлисты"
        @click="goToPlaylists"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="hidden md:inline">Плейлисты</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:px-3"
        title="История"
        @click="goToHistory"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span class="hidden md:inline">История</span>
      </button>

      <span v-if="library.isLoading" class="ml-2 text-sm text-zinc-500">
        Сканирование… {{ library.loadProgress.folders }} папок,
        {{ library.loadProgress.tracks }} треков
      </span>
      <span v-else-if="library.rootFolderName" class="ml-2 truncate text-sm text-zinc-500">
        {{ library.rootFolderName }}
      </span>
    </header>

    <main class="overflow-hidden">
      <RouterView />
    </main>

    <PlayerControls />

    <div class="app-safe-bottom"></div>
  </div>
</template>
