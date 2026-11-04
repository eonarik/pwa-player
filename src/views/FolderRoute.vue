<!-- src/views/FolderRoute.vue -->

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import FolderView from '@/views/FolderView.vue';

const route = useRoute();
const router = useRouter();
const library = useLibraryStore();

const pluginId = computed(() => String(route.params.pluginId ?? ''));

const pathSegments = computed<string[]>(() => {
  const raw = route.params.path;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.length > 0) return [raw];
  return [];
});

watch(
  () => route.params.path,
  (raw) => {
    if (!Array.isArray(raw)) return;
    if (!raw.some((s) => s === '')) return;
    router.replace({
      name: 'folder',
      params: { pluginId: pluginId.value, path: raw.filter(Boolean) },
    });
  },
  { immediate: true },
);

const urlPath = computed(() => pathSegments.value.join('/'));

const currentFolder = computed(() => {
  if (!pluginId.value) return null;
  return (
    Object.values(library.folders).find((f) => f.pluginId === pluginId.value && f.urlPath === urlPath.value) ?? null
  );
});

const folderExists = computed(() => Boolean(currentFolder.value));

watch(
  [currentFolder, pluginId],
  ([folder, pid]) => {
    if (!pid) {
      router.replace({ name: 'home' });
      return;
    }

    if (folder) {
      library.setCurrentFolder(folder.id);
      return;
    }

    // Если библиотека не пуста, но папки нет — её больше не существует.
    // (Не делаем plugin.load — восстановление делает useAppBootstrap.)
    if (Object.keys(library.folders).length > 0) {
      router.replace({ name: 'home' });
    }
  },
  { immediate: true },
);
</script>

<template>
  <FolderView v-if="folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка папки…</div>
</template>
