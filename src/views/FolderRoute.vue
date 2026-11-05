<!-- src/views/FolderRoute.vue -->

<script setup lang="ts">
import { computed, defineAsyncComponent, markRaw, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLibraryStore } from '@/stores/library';
import { findFolderView } from '@/plugins/extensions';
import FolderView from '@/views/FolderView.vue';
import type { Component } from 'vue';

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

/**
 * Ищем кастомный view (например, LogiiSeasonView / LogiiTrackView).
 * Если нашли — рендерим его вместо FolderView.
 * Если нет — FolderView (как раньше).
 */
const folderViewOverride = computed(() => {
  if (!pluginId.value) return null;
  // Не используем currentFolder для match — match работает по urlPath (например, 'logii.' в сегментах),
  // даже если папки ещё нет в библиотеке (например, ещё не отсканирована).
  return findFolderView(pluginId.value, urlPath.value);
});

const asyncComponent = computed<Component | null>(() => {
  const fv = folderViewOverride.value;
  if (!fv) return null;
  // markRaw — чтобы Vue не делал компонент реактивным (оптимизация).
  return markRaw(defineAsyncComponent(fv.component));
});

const overrideProps = computed<Record<string, unknown>>(() => {
  const fv = folderViewOverride.value;
  if (!fv) return {};
  return fv.props ? fv.props(urlPath.value) : { urlPath: urlPath.value };
});

watch(
  [currentFolder, pluginId],
  ([folder, pid]) => {
    if (!pid) {
      router.replace({ name: 'home' });
      return;
    }

    // Если folderViewOverride — не требуем, чтобы папка была в library
    // (например, плагин ещё не отсканировал её, но уже знает путь).
    if (folderViewOverride.value) {
      if (folder) library.setCurrentFolder(folder.id);
      return;
    }

    if (folder) {
      library.setCurrentFolder(folder.id);
      return;
    }

    // Если библиотека не пуста, но папки нет — её больше не существует.
    if (Object.keys(library.folders).length > 0) {
      router.replace({ name: 'home' });
    }
  },
  { immediate: true },
);
</script>

<template>
  <component :is="asyncComponent" v-if="asyncComponent" v-bind="overrideProps" />
  <FolderView v-else-if="folderExists" />
  <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка папки…</div>
</template>
