<!-- src/views/HomeView.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { needsPermission, isRestoring, hasLibrary, rootFolderName } = storeToRefs(library)

async function pickFolder() {
  const handle = await fileSystemService.pickDirectory()
  if (!handle) return

  library.clear()
  player.setQueue([], 0)

  await library.loadFromHandle(handle)

  // Явная навигация — не полагаемся на watch
  router.replace({ name: 'folder', params: { path: [] } })
}

async function restoreAccess() {
  const ok = await library.retryRestoreAfterPermission()
  if (ok) {
    router.replace({ name: 'folder', params: { path: [] } })
  } else {
    console.warn('[home] restore access failed')
  }
}

function continueToLibrary() {
  router.replace({ name: 'folder', params: { path: [] } })
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 text-zinc-400">
    <template v-if="isRestoring">
      <p class="text-sm">Восстановление библиотеки…</p>
    </template>

    <template v-else-if="needsPermission">
      <p class="text-sm">Нет доступа к сохранённой папке</p>
      <button
        type="button"
        class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
        @click="restoreAccess"
      >
        Восстановить доступ
      </button>
    </template>

    <template v-else-if="hasLibrary">
      <p class="text-sm">
        Текущая библиотека: <span class="text-zinc-200">{{ rootFolderName }}</span>
      </p>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
          @click="continueToLibrary"
        >
          Продолжить
        </button>

        <button
          type="button"
          class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
          @click="pickFolder"
        >
          Выбрать другую папку
        </button>
      </div>
    </template>

    <template v-else>
      <p class="text-sm">Выберите папку, чтобы начать</p>
      <button
        type="button"
        class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400"
        @click="pickFolder"
      >
        Выбрать папку
      </button>
    </template>
  </div>
</template>
