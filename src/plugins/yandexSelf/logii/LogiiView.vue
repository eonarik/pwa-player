<!-- src/plugins/yandexSelf/logii/LogiiView.vue -->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayerStore } from '@/stores/player';
import { useLogiiSeason, useLogiiTrack, type LogiiAuthorItem, type LogiiTrackItem } from './useLogiiData';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import LogiiAuthorsColumn from './LogiiAuthorsColumn.vue';
import LogiiFoldersColumn from './LogiiFoldersColumn.vue';
import LogiiPanel from './LogiiPanel.vue';
import Spinner from '@/components/ui/Spinner.vue';

const props = defineProps<{
  urlPath: string;
}>();

const router = useRouter();
const player = usePlayerStore();

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
const { authors, tracksByAuthor, authorMeta, seasonFolder, isReady } = useLogiiSeason(seasonUrlPath);

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
    // Уровень автора → Intro (если есть .txt)
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
  updateVibe,
} = useLogiiTrack(currentFolderUrlPath, currentLogiiFileName);

const isAuthorsCollapsed = ref(false);
const isRefreshing = ref(false);

// --- Навигация ---
function goToAuthor(author: LogiiAuthorItem): void {
  const baseSegments = segments.value.slice(0, seasonIndex.value + 1);
  router.replace({
    name: 'folder',
    params: { pluginId: 'yandex-self', path: [...baseSegments, author.folderName].join('/') },
  });
}

function goToIntro(): void {
  if (!currentAuthor.value) return;
  goToAuthor(currentAuthor.value);
}

function goToFolder(folder: LogiiTrackItem): void {
  const baseSegments = segments.value.slice(0, seasonIndex.value + 1);
  router.replace({
    name: 'folder',
    params: {
      pluginId: 'yandex-self',
      path: [...baseSegments, authorName.value, folder.folderName].join('/'),
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

// --- Чат ---
async function onSendComment(text: string): Promise<void> {
  await appendComment(text);
}

// --- Обновление ---
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
    await plugin.scanFolder(context, seasonFolder.value.id, { recursive: false, force: true });
    // После force scan перечитываем vibe текущего трека (force).
    await reloadTrack(true);
    toastService.success('Обновлено с облака');
  } catch (err) {
    console.error('[logii] refresh failed', err);
    toastService.error('Не удалось обновить');
  } finally {
    isRefreshing.value = false;
  }
}

// --- Автовыбор ---
watch(
  () => [authors.value.length, authorName.value] as const,
  ([count, name]) => {
    if (name) return;
    if (count === 0) return;
    goToAuthor(authors.value[0]!);
  },
);

watch(
  () => [authorFolders.value.length, folderName.value, hasAuthorIntro.value] as const,
  ([count, name, hasIntro]) => {
    if (name) return; // папка уже выбрана
    if (count === 0) return;
    if (hasIntro) return; // показываем Intro, не автовыбираем
    goToFolder(authorFolders.value[0]!);
  },
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
        @select="goToAuthor"
        @toggle-collapsed="isAuthorsCollapsed = !isAuthorsCollapsed"
      />

      <LogiiFoldersColumn
        :folders="authorFolders"
        :current-folder-name="folderName"
        :current-author-name="authorName"
        :has-author-intro="hasAuthorIntro"
        :author-intro-file-name="authorIntroFileName"
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
        :on-retry="reloadTrack"
        :on-refresh="onRefresh"
        :on-play-track="playTrack"
        :on-play-all="playAllAudio"
        :on-update-vibe="updateVibe"
        :on-send-comment="onSendComment"
      />
    </template>
  </div>
</template>
