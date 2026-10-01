<!-- src/components/library/Breadcrumbs.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import type { Folder } from '@/types/library'

const router = useRouter()
const library = useLibraryStore()
const { breadcrumbs, currentFolder } = storeToRefs(library)

const pluginId = computed(() => currentFolder.value?.source ?? '')

const isPluginRoot = computed(() => {
  const folder = currentFolder.value
  return folder !== null && folder.parentId === null
})

function goUp() {
  if (!currentFolder.value) {
    router.push({ name: 'home' })
    return
  }

  if (isPluginRoot.value) {
    router.push({ name: 'home' })
    return
  }

  const parentId = currentFolder.value.parentId
  if (!parentId) {
    router.push({ name: 'home' })
    return
  }

  const parent = library.getFolder(parentId)
  if (!parent) {
    router.push({ name: 'home' })
    return
  }

  if (!parent.source) {
    router.push({ name: 'home' })
    return
  }

  const segments = parent.path.split('/').filter(Boolean)
  router.push({
    name: 'folder',
    params: { pluginId: parent.source, path: segments },
  })
}

function goToFolder(crumb: Folder) {
  if (!crumb.source) return
  const segments = crumb.path.split('/').filter(Boolean)
  router.push({
    name: 'folder',
    params: { pluginId: crumb.source, path: segments },
  })
}
</script>

<template>
  <nav class="flex min-w-0 items-center gap-1 text-sm" aria-label="Навигация по папкам">
    <button v-if="currentFolder" type="button"
      class="mr-1 shrink-0 rounded-btn p-1.5 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
      :aria-label="isPluginRoot ? 'К источникам' : 'Назад'" @click="goUp">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>

    <template v-for="(crumb, i) in breadcrumbs" :key="crumb.id">
      <button type="button" class="truncate rounded-btn px-1.5 py-0.5 transition hover:bg-hover-bg hover:text-fg"
        :class="i === breadcrumbs.length - 1 ? 'font-medium text-fg' : 'text-fg-muted'"
        :title="crumb.path || crumb.name" @click="goToFolder(crumb)">
        {{ crumb.name }}
      </button>

      <span v-if="i < breadcrumbs.length - 1" class="shrink-0 text-fg-subtle">/</span>
    </template>

    <span v-if="breadcrumbs.length === 0" class="text-fg-muted">Источники</span>
  </nav>
</template>
