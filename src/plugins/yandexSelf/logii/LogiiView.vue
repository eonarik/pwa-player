<!-- src/plugins/yandexSelf/logii/LogiiView.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useLogiiSeason, useLogiiTrack, type LogiiAuthorItem, type LogiiTrackItem } from './useLogiiData';
import { resolveLogiiNavigationAfterRefresh, resolveSeasonParentUrlPath } from './navigation';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import { urlPathToSegments } from '@/utils/urlPath';
import LogiiAuthorsColumn from './LogiiAuthorsColumn.vue';
import LogiiFoldersColumn from './LogiiFoldersColumn.vue';
import LogiiPanel from './LogiiPanel.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { FolderRef } from '@/types/folder.ts';

const props = defineProps<{
  urlPath: string;
}>();

const router = useRouter();
const player = usePlayerStore();
const library = useLibraryStore();

// --- Парсинг urlPath ---
const segments = computed(() => props.urlPath.split('/').filter(Boolean));
const seasonIndex = computed(() => segments.value.findIndex((s) => s.startsWith('logii.')));

const seasonUrlPath = computed(() => {
  if (seasonIndex.value === -1) return '';
  return segments.value.slice(0, seasonIndex.value + 1).join('/');
});

const authorName = computed<string | null>(() => {
  if (seasonIndex.value === -1) return null;
  return segments.value[seasonIndex.value + 1] ?? null;
});

const folderName = computed<string | null>(() => {
  if (seasonIndex.value === -1) return null;
  return segments.value[seasonIndex.value + 2] ?? null;
});

// --- Сезон ---
const { authors, tracksByAuthor, allTracksByAuthor, authorMeta, seasonFolder, isReady } = useLogiiSeason(seasonUrlPath);

const currentAuthor = computed<LogiiAuthorItem | null>(() => {
  if (!authorName.value) return null;
  return authors.value.find((a) => a.folderName === authorName.value) ?? null;
});

const authorFolders = computed<LogiiTrackItem[]>(() => {
  if (!currentAuthor.value) return [];
  return tracksByAuthor.value.get(currentAuthor.value.urlPath) ?? [];
});

const authorIntro = computed<LogiiTrackItem | null>(() => {
  if (!currentAuthor.value) return null;
  return authorMeta.value.get(currentAuthor.value.urlPath) ?? null;
});

const hasAuthorIntro = computed(() => Boolean(authorIntro.value?.logiiFileName));
const authorIntroFileName = computed(() => authorIntro.value?.logiiFileName ?? null);

const currentFolder = computed<LogiiTrackItem | null>(() => {
  if (!authorName.value) return null;
  if (!folderName.value) {
    return hasAuthorIntro.value ? authorIntro.value : null;
  }
  return authorFolders.value.find((f) => f.folderName === folderName.value) ?? null;
});

const currentFolderUrlPath = computed(() => currentFolder.value?.urlPath ?? '');
const currentLogiiFileName = computed(() => currentFolder.value?.logiiFileName ?? null);

// --- Трек ---
const {
  data: logiiData,
  isLoading: isLoadingTrack,
  isSaving,
  error: trackError,
  reload: reloadTrack,
  appendComment,
  updateComment,
  deleteComment,
  updateVibe,
} = useLogiiTrack(currentFolderUrlPath, currentLogiiFileName);

const isAuthorsCollapsed = ref(false);
const isRefreshing = ref(false);

// --- Кнопка «К папкам» ---
const canGoToParent = computed(() => {
  if (!seasonUrlPath.value) return false;
  return true;
});

function goToParent(): void {
  if (!seasonUrlPath.value) {
    router.push({ name: 'folder', params: { pluginId: 'yandex-self', path: [] } });
    return;
  }
  const parentUrlPath = resolveSeasonParentUrlPath(seasonUrlPath.value, library.folders);
  router.push({
    name: 'folder',
    params: { pluginId: 'yandex-self', path: urlPathToSegments(parentUrlPath) },
  });
}

// --- Навигация ---
function goToAuthor(author: LogiiAuthorItem): void {
  const baseSegments = segments.value.slice(0, seasonIndex.value + 1);
  router.replace({
    name: 'folder',
    params: { pluginId: 'yandex-self', path: [...baseSegments, author.folderName] },
  });
}

function goToIntro(): void {
  if (!currentAuthor.value) return;
  goToAuthor(currentAuthor.value);
}

function goToFolder(folder: LogiiTrackItem): void {
  if (!authorName.value) return;
  const baseSegments = segments.value.slice(0, seasonIndex.value + 1);
  router.replace({
    name: 'folder',
    params: {
      pluginId: 'yandex-self',
      path: [...baseSegments, authorName.value, folder.folderName],
    },
  });
}

// --- Плеер ---
function playTrack(index: number): void {
  const tracks = currentFolder.value?.audioTracks ?? [];
  if (tracks.length === 0) return;
  player.setQueue(tracks, index);
}

function playAllAudio(): void {
  const tracks = currentFolder.value?.audioTracks ?? [];
  if (tracks.length === 0) return;
  player.playAll(tracks);
}

function playAuthor(author: LogiiAuthorItem): void {
  const tracks = allTracksByAuthor.value.get(author.urlPath) ?? [];
  if (tracks.length === 0) return;

  const currentId = player.currentTrack?.id ?? null;
  const isThisAuthorCurrent = currentId !== null && tracks.some((t) => t.id === currentId);

  if (isThisAuthorCurrent && player.isPlaying) {
    player.toggle();
    return;
  }

  player.playAll(tracks);
}

// --- Чат ---
async function onSendComment(text: string): Promise<void> {
  await appendComment(text);
}

// --- Обновление (рекурсивное) ---
async function onRefresh(): Promise<void> {
  if (!seasonFolder.value) return;
  if (isRefreshing.value) return;

  isRefreshing.value = true;
  try {
    const plugin = await loadPlugin('yandex-self');
    if (!plugin.scanFolder) {
      toastService.error('Плагин не поддерживает сканирование');
      return;
    }
    const context = createPluginContext('yandex-self');
    await plugin.scanFolder(context, seasonFolder.value.id, { recursive: true, force: true });

    const nav = resolveLogiiNavigationAfterRefresh({
      seasonUrlPath: seasonUrlPath.value,
      authorName: authorName.value,
      folderName: folderName.value,
      folders: library.folders,
    });

    if (nav.level === 'root') {
      toastService.success('Обновлено с облака');
      router.replace({ name: 'folder', params: { pluginId: 'yandex-self', path: [] } });
      return;
    }

    if (nav.level !== 'folder') {
      toastService.success('Обновлено с облака');
      router.replace({
        name: 'folder',
        params: { pluginId: 'yandex-self', path: urlPathToSegments(nav.urlPath) },
      });
      return;
    }

    await reloadTrack(true);
    toastService.success('Обновлено с облака');
  } catch (err) {
    console.error('[logii] refresh failed', err);
    toastService.error('Не удалось обновить');
  } finally {
    isRefreshing.value = false;
  }
}

// --- Автовыбор (объединённый) ---
watch(
  () => [authors.value.length, authorName.value, folderName.value] as const,
  ([count, author, folder], prev) => {
    // 1. Первый заход в сезон — выбрать первого автора.
    if (!author && count > 0) {
      goToAuthor(authors.value[0]!);
      return;
    }

    // 2. Автовыбор папки:
    //    - если сменился автор (клик на другого) — выбираем первую папку;
    //    - если автор тот же, а папка стала null (refresh удалил папку) — не выбираем.
    if (author && !folder) {
      const prevAuthor = prev?.[1] ?? null;
      const prevFolder = prev?.[2] ?? null;

      if (prevAuthor === author && prevFolder !== null) return;

      if (authorFolders.value.length === 0) return;
      if (hasAuthorIntro.value) return;
      goToFolder(authorFolders.value[0]!);
    }
  },
  { immediate: true },
);

// --- Vibe reload ---
let lastLoadedKey = '';
watch(
  () => `${currentFolderUrlPath.value}|${currentLogiiFileName.value ?? ''}`,
  (key) => {
    const urlPath = currentFolderUrlPath.value;
    if (!urlPath) {
      lastLoadedKey = '';
      return;
    }
    if (key === lastLoadedKey) return;
    lastLoadedKey = key;
    void reloadTrack();
  },
  { immediate: true },
);

onMounted(() => {
  if (currentFolderUrlPath.value) {
    const key = `${currentFolderUrlPath.value}|${currentLogiiFileName.value ?? ''}`;
    if (key !== lastLoadedKey) {
      lastLoadedKey = key;
      void reloadTrack();
    }
  }
});

const currentAuthorFolder = computed<FolderRef | null>(() => {
  if (!currentAuthor.value) return null;
  for (const f of Object.values(library.folders)) {
    if (f.pluginId === 'yandex-self' && f.urlPath === currentAuthor.value.urlPath) return f;
  }
  return null;
});
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <div v-if="!isReady" class="flex flex-1 items-center justify-center">
      <Spinner size="lg" text="Загружаем сезон…" />
    </div>

    <template v-else>
      <LogiiAuthorsColumn
        :authors="authors"
        :current-author-name="authorName"
        :is-loading="false"
        :is-collapsed="isAuthorsCollapsed"
        :all-tracks-by-author="allTracksByAuthor"
        :season-folder="seasonFolder"
        @select="goToAuthor"
        @toggle-collapsed="isAuthorsCollapsed = !isAuthorsCollapsed"
        @play-author="playAuthor"
      />

      <LogiiFoldersColumn
        :folders="authorFolders"
        :current-folder-name="folderName"
        :current-author-name="authorName"
        :has-author-intro="hasAuthorIntro"
        :author-intro-file-name="authorIntroFileName"
        :author-folder="currentAuthorFolder"
        :season-folder="seasonFolder"
        @select="goToFolder"
        @select-intro="goToIntro"
      />

      <LogiiPanel
        :author-name="authorName"
        :folder="currentFolder"
        :data="logiiData"
        :is-loading="isLoadingTrack"
        :is-saving="isSaving"
        :is-refreshing="isRefreshing"
        :error="trackError"
        :can-go-to-parent="canGoToParent"
        :on-retry="reloadTrack"
        :on-refresh="onRefresh"
        :on-go-to-parent="goToParent"
        :on-play-track="playTrack"
        :on-play-all="playAllAudio"
        :on-update-vibe="updateVibe"
        :on-send-comment="onSendComment"
        :on-update-comment="updateComment"
        :on-delete-comment="deleteComment"
      />
    </template>
  </div>
</template>
