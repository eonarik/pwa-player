<!-- src/App.vue -->
<script setup lang="ts">
import { watchEffect, onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { usePlaylistsStore } from '@/stores/playlists'
import { useHistoryStore } from '@/stores/history'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaSession } from '@/composables/useMediaSession'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { loadLastSource } from '@/services/persistence/lastSource'
import PlayerControls from '@/components/player/PlayerControls.vue'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
const history = useHistoryStore()
const { currentTrack, isPlaying, queue } = storeToRefs(player)

// --- Меню хедера ------------------------------------------------------

const isNavMenuOpen = ref(false)

const queueBadge = computed(() => (queue.value.length > 0 ? String(queue.value.length) : ''))

function closeNavMenu() {
  isNavMenuOpen.value = false
}

function goHome() {
  isNavMenuOpen.value = false
  router.push({ name: 'home' })
}

function goToRoot() {
  isNavMenuOpen.value = false
  router.push({ name: 'folder', params: { path: [] } })
}

function goToPlaylists() {
  isNavMenuOpen.value = false
  router.push({ name: 'playlists' })
}

function goToHistory() {
  isNavMenuOpen.value = false
  router.push({ name: 'history' })
}

function goToQueue() {
  isNavMenuOpen.value = false
  router.push({ name: 'queue' })
}

// --- Горячие клавиши, медиа-сессия, заголовок -------------------------

useKeyboardShortcuts({
  onToggle: () => player.toggle(),
  onToggleMute: () => player.toggleMute(),
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
  document.title = t ? `${t.title} — ${t.artist}` : 'CUEI Media Player'
})

// --- Восстановление при старте ----------------------------------------

onMounted(async () => {
  // 1. Обложки — сначала, потому что нужны при восстановлении библиотеки
  await coverPersistenceService.load()

  // 2. История
  await history.restore()

  // 3. Источник библиотеки
  const lastSource = await loadLastSource()
  console.info('[app] last source:', lastSource)

  let libraryRestored = false

  if (lastSource === 'yandex') {
    libraryRestored = await library.restoreYandexFromCache()
    if (!libraryRestored) {
      libraryRestored = await library.restore()
    }
  } else if (lastSource === 'local') {
    libraryRestored = await library.restore()
  } else {
    libraryRestored = await library.restore()
  }

  if (libraryRestored) {
    console.info('[app] library restored')
    // Редиректим на корень библиотеки только если мы на главной.
    if (router.currentRoute.value.name === 'home') {
      router.replace({ name: 'folder', params: { path: [] } })
    }
  }

  // 4. Плеер
  const playerRestored = await player.restore()
  if (playerRestored) console.log('[player] restored')
})
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-zinc-900 text-zinc-100">
    <header class="app-safe-top flex items-center gap-3 border-b border-zinc-800 p-3">
      <button
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        title="На главную (выбор источника)" @click="goHome">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
        </svg>
        <span class="hidden md:inline">Главная</span>
      </button>

      <button v-if="library.hasLibrary" type="button"
        class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        @click="goToRoot">
        ← <span class="hidden md:inline">К библиотеке</span>
      </button>

      <!-- Меню навигации: Плейлисты / История / Очередь -->
      <div class="relative">
        <button type="button"
          class="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:px-3"
          :aria-expanded="isNavMenuOpen" aria-haspopup="menu" title="Меню" @click="isNavMenuOpen = !isNavMenuOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span class="hidden md:inline">Меню</span>

          <!-- Бейдж с количеством треков в очереди -->
          <span v-if="queueBadge"
            class="ml-0.5 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-400">
            {{ queueBadge }}
          </span>
        </button>

        <!-- Дропдаун -->
        <div v-if="isNavMenuOpen"
          class="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg"
          role="menu">
          <button type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
            role="menuitem" @click="goToPlaylists">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
              <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Плейлисты
          </button>

          <button type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
            role="menuitem" @click="goToHistory">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            История
          </button>

          <button type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
            role="menuitem" @click="goToQueue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
              <path d="M4 6h16M4 12h10M4 18h6" />
            </svg>
            <span class="flex-1">Очередь</span>
            <span v-if="queueBadge"
              class="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-400">
              {{ queueBadge }}
            </span>
          </button>
        </div>
      </div>

      <span v-if="library.isLoading" class="ml-2 text-sm text-zinc-500">
        Сканирование… {{ library.loadProgress.folders }} папок,
        {{ library.loadProgress.tracks }} треков
      </span>
      <span v-else-if="library.rootFolderName" class="ml-2 truncate text-sm text-zinc-500">
        {{ library.rootFolderName }}
      </span>

      <!-- Закрытие меню по клику вне -->
      <div v-if="isNavMenuOpen" class="fixed inset-0 z-20" aria-hidden="true" @click="closeNavMenu" />
    </header>

    <main class="overflow-hidden">
      <RouterView />
    </main>

    <PlayerControls />
  </div>
</template>
