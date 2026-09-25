<!-- src/components/library/Breadcrumbs.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'

const router = useRouter()
const library = useLibraryStore()
const { breadcrumbs, canGoUp } = storeToRefs(library)

function goToFolder(folderPath: string) {
  const segments = folderPath.split('/').filter(Boolean)
  router.push({ name: 'folder', params: { path: segments } })
}

/**
 * Кнопка «Назад» ведёт себя как браузерная:
 * использует history.back(), если есть куда возвращаться.
 * Иначе — fallback на родительскую папку через replace,
 * чтобы не плодить записи в истории.
 */
function goUp() {
  const hasHistory = typeof window !== 'undefined' && Boolean(window.history.state?.back)

  if (hasHistory) {
    router.back()
    return
  }

  // Fallback: пользователь пришёл по прямой ссылке — ведём к родителю
  const crumbs = breadcrumbs.value
  if (crumbs.length < 2) return
  const parent = crumbs[crumbs.length - 2]
  if (!parent) return

  const segments = parent.path.split('/').filter(Boolean)
  router.replace({ name: 'folder', params: { path: segments } })
}
</script>

<template>
  <nav class="flex items-center gap-1 text-sm" aria-label="Навигация по папкам">
    <button
      v-if="canGoUp"
      type="button"
      class="mr-1 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      aria-label="Назад"
      @click="goUp"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>

    <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id">
      <button
        type="button"
        class="truncate rounded px-1.5 py-0.5 transition hover:bg-zinc-800 hover:text-zinc-100"
        :class="i === breadcrumbs.length - 1 ? 'font-medium text-zinc-100' : 'text-zinc-400'"
        :title="crumb.path || 'Корень'"
        @click="goToFolder(crumb.path)"
      >
        {{ crumb.name }}
      </button>

      <span v-if="i < breadcrumbs.length - 1" class="text-zinc-600">/</span>
    </template>
  </nav>
</template>
