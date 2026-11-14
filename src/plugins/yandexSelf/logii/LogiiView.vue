// src/plugins/yandexSelf/logii/LogiiView.vue

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useLogiiSeason, useLogiiTrack } from './useLogiiData';
import { useLogiiRoute } from './composables/useLogiiRoute';
import { useLogiiSelection } from './composables/useLogiiSelection';
import { useLogiiNavigation } from './composables/useLogiiNavigation';
import { useLogiiPlayback } from './composables/useLogiiPlayback';
import { useLogiiRefresh } from './composables/useLogiiRefresh';
import { useLogiiChanges } from './composables/useLogiiChanges';
import LogiiAuthorsColumn from './LogiiAuthorsColumn.vue';
import LogiiFoldersColumn from './LogiiFoldersColumn.vue';
import LogiiPanel from './LogiiPanel.vue';
import LogiiChangesButton from './LogiiChangesButton.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import type { FolderRef } from '@/types/folder';
import { urlPathToSegments } from '@/utils/urlPath';

const props = defineProps<{
  urlPath: string;
}>();

const router = useRouter();
const player = usePlayerStore();
const library = useLibraryStore();

const folders = computed(() => library.folders);

const route = useLogiiRoute(computed(() => props.urlPath));
const season = useLogiiSeason(route.seasonUrlPath);
const selection = useLogiiSelection(season, route, folders);
const navigation = useLogiiNavigation({ route, currentAuthor: selection.currentAuthor, folders, router });
const playback = useLogiiPlayback({
  currentFolder: selection.currentFolder,
  allTracksByAuthor: season.allTracksByAuthor,
  player,
});

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
} = useLogiiTrack(selection.currentFolderUrlPath, selection.currentLogiiFileName);

// --- Синхронизация изменений ---
const seasonUrlPath = computed(() => season.seasonFolder.value?.urlPath ?? '');
const logiiFolders = computed<Record<string, FolderRef>>(() => {
  // Собираем все папки сезона из библиотеки
  const result: Record<string, FolderRef> = {};
  if (!season.seasonFolder.value) return result;
  const seasonId = season.seasonFolder.value.id;
  for (const f of Object.values(folders.value)) {
    if (f.pluginId !== 'yandex-self') continue;
    if (f.id === seasonId || f.parentId === seasonId) {
      result[f.urlPath] = f;
    } else {
      // Проверяем, является ли родитель автором сезона
      const parent = f.parentId ? folders.value[f.parentId] : undefined;
      if (parent && parent.parentId === seasonId) {
        result[f.urlPath] = f;
      }
    }
  }
  return result;
});

const changes = useLogiiChanges({ seasonUrlPath, folders: logiiFolders });

const { isRefreshing, onRefresh } = useLogiiRefresh({
  seasonFolder: season.seasonFolder,
  route,
  folders,
  router,
  reloadTrack,
  initScan: async (prev) => {
    const snapshot = prev ?? (await changes.readPrevSnapshot());
    await changes.initScan(snapshot);
  },
  onAfterFileScan: changes.onAfterFileScan,
  onAfterFolderScan: changes.onAfterFolderScan,
  finalizeScan: changes.finalizeScan,
  applyScanResult: changes.applyScanResult,
  seasonUrlPath,
});

// Отключено: сетевой триггер скана (onMounted + watch author|folder).
// Скан по-прежнему доступен через кнопку refresh в LogiiPanel (onRefresh).
// let syncTimer: ReturnType<typeof setTimeout> | null = null;
// const isSyncing = ref(false);

// async function runFullCheck(): Promise<void> {
//   if (isRefreshing.value) return;
//   if (isSyncing.value) return;
//
//   isSyncing.value = true;
//   try {
//     const prevSnapshot = await changes.readPrevSnapshot();
//     await changes.initScan(prevSnapshot ?? null);
//
//     const plugin = await import('@/plugins/registry').then((m) => m.loadPlugin('yandex-self'));
//     if (plugin.scanFolder) {
//       const context = await import('@/plugins/context').then((m) => m.createPluginContext('yandex-self'));
//       await plugin.scanFolder(context, season.seasonFolder.value!.id, {
//         recursive: true,
//         force: true,
//         onAfterFileScan: changes.onAfterFileScan,
//         onAfterFolderScan: changes.onAfterFolderScan,
//       });
//     }
//     await changes.finalizeScan(seasonUrlPath.value);
//     changes.applyScanResult();
//   } catch {
//     // ignore — скан покажет ошибку сам
//   } finally {
//     isSyncing.value = false;
//   }
// }

// function triggerSync(): void {
//   if (syncTimer !== null) clearTimeout(syncTimer);
//   syncTimer = setTimeout(() => {
//     syncTimer = null;
//     void runFullCheck();
//   }, 500);
// }

// onMounted(() => {
//   void runFullCheck();
// });

// watch(
//   () => `${route.authorName.value}|${route.folderName.value}`,
//   () => {
//     triggerSync();
//   },
// );
//   },
// );

// Интеграция applyTextChange: после reload feed modified в снимок
watch(
  () => logiiData.value,
  () => {
    const urlPath = currentFolderUrlPath.value;
    const fileName = currentLogiiFileName.value;
    if (urlPath && fileName) {
      // logiiData обновился — feed в снимок через changes.applyTextChange
      // (modified приходит из readLogiiFile, но мы не храним его в logiiData —
      // вместо этого просто обновляем снимок через applyScanResult)
      changes.applyScanResult();
    }
  },
  { flush: 'post' },
);

function onChangeNavigate(urlPath: string): void {
  router.push({ name: 'folder', params: { pluginId: 'yandex-self', path: urlPathToSegments(urlPath) } });
}

function onClearEvents(): void {
  changes.clearEvents();
}

// --- Конец синхронизации ---

const { authors, allTracksByAuthor, seasonFolder, isReady } = season;
const {
  authorFolders,
  hasAuthorIntro,
  authorIntroFileName,
  currentFolder,
  currentFolderUrlPath,
  currentLogiiFileName,
  currentAuthorFolder,
} = selection;
const { canGoToParent, goToParent, goToAuthor, goToIntro, goToFolder } = navigation;
const { playTrack, playAllAudio, playAuthor } = playback;
const { authorName, folderName } = route;

// CUEI-0009: в текущем топе играет трек (playback) отдельно от «топ открыт» (навигация)
const isCurrentTopPlaying = computed(() => {
  const folder = currentFolder.value;
  const track = player.currentTrack;
  return Boolean(folder && track && folder.audioTracks.some((t) => t.id === track.id));
});

const isAuthorsCollapsed = ref(false);

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

// --- Чат ---
async function onSendComment(text: string): Promise<void> {
  await appendComment(text);
}
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
        :is-current-top-playing="isCurrentTopPlaying"
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
      >
        <template #header-actions>
          <LogiiChangesButton
            :unread-count="changes.unreadCount.value"
            :events="changes.pendingEvents.value"
            @navigate="onChangeNavigate"
            @clear="onClearEvents"
          />
        </template>
      </LogiiPanel>
    </template>
  </div>
</template>
