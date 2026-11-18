<!-- src/plugins/yandexSelf/logii/LogiiView.vue -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { useMediaQuery } from '@/composables/useMediaQuery';
import { storeToRefs } from 'pinia';
import { useSwipe } from '@vueuse/core';
import { useLogiiSeason, useLogiiTrack } from './useLogiiData';
import { useLogiiRoute } from './composables/useLogiiRoute';
import { useLogiiSelection } from './composables/useLogiiSelection';
import { useLogiiNavigation } from './composables/useLogiiNavigation';
import { useLogiiPlayback } from './composables/useLogiiPlayback';
import { useLogiiRefresh } from './composables/useLogiiRefresh';
import { useLogiiChanges } from './composables/useLogiiChanges';
import { useLogiiPager } from './composables/useLogiiPager';
import { useLogiiAutoSelect } from './composables/useLogiiAutoSelect';
import { useEditMode } from './composables/useEditMode';
import LogiiAuthorsColumn from './LogiiAuthorsColumn.vue';
import LogiiFoldersColumn from './LogiiFoldersColumn.vue';
import LogiiPanel, { type LogiiTab } from './LogiiPanel.vue';
import LogiiPanelHeader from './LogiiPanelHeader.vue';
import LogiiChangesButton from './LogiiChangesButton.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import type { FolderRef } from '@/types/folder';
import { urlPathToSegments } from '@/utils/urlPath';

const props = defineProps<{ urlPath: string }>();

const router = useRouter();
const player = usePlayerStore();
const { currentTrack } = storeToRefs(player);
const library = useLibraryStore();
const { isEditMode } = useEditMode();

const isMobile = useMediaQuery('(max-width: 767px)');
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

const activeTab = ref<LogiiTab>('track');

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
  const result: Record<string, FolderRef> = {};
  if (!season.seasonFolder.value) return result;
  const seasonId = season.seasonFolder.value.id;
  for (const f of Object.values(folders.value)) {
    if (f.pluginId !== 'yandex-self') continue;
    if (f.id === seasonId || f.parentId === seasonId) {
      result[f.urlPath] = f;
    } else {
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

watch(
  () => logiiData.value,
  () => {
    if (currentFolderUrlPath.value && currentLogiiFileName.value) {
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

const isCurrentTopPlaying = computed(() => {
  const folder = currentFolder.value;
  const track = currentTrack.value;
  return Boolean(folder && track && folder.audioTracks.some((t) => t.id === track.id));
});

const isAuthorsCollapsed = ref(false);

// --- Мобильная постраничная навигация ---
const pager = useLogiiPager({
  route,
  authors,
  authorFolders,
  hasAuthorIntro,
  currentFolder,
  goToAuthor,
  goToFolder,
  goToIntro,
  router,
});

useLogiiAutoSelect({
  authors,
  authorFolders,
  authorName,
  folderName,
  hasAuthorIntro,
  isMobile,
  goToAuthor,
  goToFolder,
});

// --- Данные для предпросмотра экранов на мобилке (чтобы не было пустоты при свайпе) ---
const mobileFallbackAuthor = computed(() => {
  if (authorName.value || !isMobile.value) return null;
  return authors.value[0] ?? null;
});

const effectiveAuthorName = computed(() => authorName.value || mobileFallbackAuthor.value?.folderName || null);

const effectiveFolders = computed(() => {
  if (authorName.value) return authorFolders.value;
  if (mobileFallbackAuthor.value) return season.tracksByAuthor.value.get(mobileFallbackAuthor.value.urlPath) ?? [];
  return [];
});

const effectiveIntro = computed(() => {
  if (authorName.value) return hasAuthorIntro.value;
  if (mobileFallbackAuthor.value) {
    return Boolean(season.authorMeta.value.get(mobileFallbackAuthor.value.urlPath)?.logiiFileName);
  }
  return false;
});

const effectiveIntroFileName = computed(() => {
  if (authorName.value) return authorIntroFileName.value;
  if (mobileFallbackAuthor.value) {
    return season.authorMeta.value.get(mobileFallbackAuthor.value.urlPath)?.logiiFileName ?? null;
  }
  return null;
});

const effectiveAuthorFolder = computed(() => {
  if (currentAuthorFolder.value) return currentAuthorFolder.value;
  if (mobileFallbackAuthor.value) {
    return (
      Object.values(folders.value).find(
        (f) => f.pluginId === 'yandex-self' && f.urlPath === mobileFallbackAuthor.value!.urlPath,
      ) ?? null
    );
  }
  return null;
});

const mobileFallbackFolder = computed(() => {
  if (currentFolder.value || !isMobile.value) return null;
  if (authorName.value && !hasAuthorIntro.value && authorFolders.value.length > 0) {
    return authorFolders.value[0] ?? null;
  }
  return null;
});

// --- Нативный свайп из @vueuse/core ---
const carouselRef = ref<HTMLElement | null>(null);

useSwipe(carouselRef, {
  passive: false,
  onSwipeEnd(_e, direction) {
    if (!isMobile.value) return;

    // Реагируем только на явные горизонтальные свайпы
    if (direction === 'left') {
      pager.goNext();
    } else if (direction === 'right') {
      pager.goPrev();
    }
  },
});

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
  <div class="flex h-full overflow-hidden relative">
    <div v-if="!isReady" class="flex flex-1 items-center justify-center">
      <Spinner size="lg" text="Загружаем сезон…" />
    </div>

    <template v-else>
      <div class="flex flex-col h-full w-full">
        <!-- ХЕДЕР (без табов, они теперь в панели) -->

        <LogiiPanelHeader
          :page-index="pager.pageIndex.value"
          :author-name="authorName"
          :folder-name="folderName"
          :logii-file-name="currentLogiiFileName"
          :is-refreshing="isRefreshing"
          :can-go-to-parent="canGoToParent"
          :is-edit-mode="isEditMode"
          :is-mobile="isMobile"
          @refresh="onRefresh()"
          @go-to-parent="goToParent"
          @go-prev="pager.goPrev"
          @update:is-edit-mode="isEditMode = $event"
        >
          <template #header-actions>
            <LogiiChangesButton
              :unread-count="changes.unreadCount.value"
              :events="changes.pendingEvents.value"
              @navigate="onChangeNavigate"
              @clear="onClearEvents"
            />
          </template>
        </LogiiPanelHeader>

        <!-- КАРУСЕЛЬ -->
        <div ref="carouselRef" class="flex flex-1 w-full overflow-hidden">
          <div
            class="flex h-full w-full transition-transform duration-300 ease-out"
            :style="isMobile ? { transform: `translateX(-${pager.pageIndex.value * 100}%)` } : {}"
          >
            <LogiiAuthorsColumn
              :authors="authors"
              :current-author-name="effectiveAuthorName"
              :is-loading="false"
              :is-collapsed="isAuthorsCollapsed"
              :all-tracks-by-author="allTracksByAuthor"
              :season-folder="seasonFolder"
              :is-edit-mode="isEditMode"
              :is-mobile="isMobile"
              @select="goToAuthor"
              @toggle-collapsed="isAuthorsCollapsed = !isAuthorsCollapsed"
              @play-author="playAuthor"
            />

            <LogiiFoldersColumn
              :folders="effectiveFolders"
              :current-folder-name="folderName"
              :is-current-top-playing="isCurrentTopPlaying"
              :current-author-name="authorName || mobileFallbackAuthor?.folderName || null"
              :has-author-intro="effectiveIntro"
              :author-intro-file-name="effectiveIntroFileName"
              :author-folder="effectiveAuthorFolder"
              :season-folder="seasonFolder"
              :is-edit-mode="isEditMode"
              :is-mobile="isMobile"
              @select="goToFolder"
              @select-intro="goToIntro"
            />

            <!-- ПАНЕЛЬ (табы внутри) -->
            <LogiiPanel
              :folder="currentFolder || mobileFallbackFolder"
              :data="logiiData"
              :is-loading="isLoadingTrack"
              :is-saving="isSaving"
              :error="trackError"
              :is-edit-mode="isEditMode"
              :is-mobile="isMobile"
              :active-tab="activeTab"
              :on-retry="reloadTrack"
              :on-play-track="playTrack"
              :on-play-all="playAllAudio"
              :on-update-vibe="updateVibe"
              :on-send-comment="onSendComment"
              :on-update-comment="updateComment"
              :on-delete-comment="deleteComment"
              @update:active-tab="activeTab = $event"
            />
          </div>
        </div>
      </div>

      <!-- Индикатор страниц -->
      <div
        v-if="isMobile"
        class="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex items-center justify-center gap-2"
        data-testid="logii-pager-dots"
      >
        <button
          v-for="i in pager.pagesCount"
          :key="i - 1"
          type="button"
          class="pointer-events-auto h-2 w-2 rounded-full transition"
          :class="pager.pageIndex.value === i - 1 ? 'bg-active' : 'bg-fg-subtle/40'"
          :aria-label="`Страница ${i}`"
          :data-testid="`logii-pager-dot-${i - 1}`"
          @click="pager.goToPage(i - 1)"
        />
      </div>
    </template>
  </div>
</template>
