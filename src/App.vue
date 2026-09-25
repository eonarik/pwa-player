<!-- src/App.vue -->
<script setup lang="ts">
import { watchEffect, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaSession } from '@/composables/useMediaSession'
import PlayerControls from '@/components/player/PlayerControls.vue'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()
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

onMounted(async () => {
  console.log('[app] starting restore')
  try {
    await library.restore()
    console.log('[app] library restore done, hasLibrary:', library.hasLibrary)
  } catch (err) {
    console.error('[app] library restore failed', err)
  }

  const playerRestored = await player.restore()
  if (playerRestored) console.log('[player] restored')
})
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-zinc-900 text-zinc-100">
    <header class="flex items-center gap-2 border-b border-zinc-800 p-3">
      <!-- Кнопка «Главная» — всегда видна, ведёт на выбор папки -->
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        title="На главную (выбор папки)"
        @click="goHome"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
        </svg>
        <span>Главная</span>
      </button>

      <!-- Кнопка «К библиотеке» — только когда есть библиотека -->
      <button
        v-if="library.hasLibrary"
        type="button"
        class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        @click="goToRoot"
      >
        ← К библиотеке
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
  </div>
</template>
