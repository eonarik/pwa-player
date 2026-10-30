<!-- src/views/FolderRoute.vue -->

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
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
  async ([folder, pid]) => {
    if (!pid) {
      router.replace({ name: 'home' });
      return;
    }

    if (folder) {
      library.setCurrentFolder(folder.id);
      return;
    }

    // Восстанавливаем при перезагрузке (грузим корень из кеша)
    try {
      const plugin = await loadPlugin(pluginIdFromSource(pid));
      const context = createPluginContext(pid);
      const snapshot = await plugin.load(context);
      await context.writer.setLibrary(snapshot, pid);
    } catch (err) {
      console.warn('[FolderRoute] failed to load on reload', err);
    }
  },
  { immediate: true },
);
</script>

<template>
  <FolderView v-if="folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка папки…</div>
</template>
