<!-- src/plugins/yandexSelf/logii/LogiiView.vue -->

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
import LogiiAuthorsColumn from './LogiiAuthorsColumn.vue';
import LogiiFoldersColumn from './LogiiFoldersColumn.vue';
import LogiiPanel from './LogiiPanel.vue';
import Spinner from '@/components/atoms/Spinner.vue';

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

const { isRefreshing, onRefresh } = useLogiiRefresh({
  seasonFolder: season.seasonFolder,
  route,
  folders,
  router,
  reloadTrack,
});

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
