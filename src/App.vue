<!-- src/App.vue -->

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useMediaSession } from '@/composables/useMediaSession';
import { usePwaUpdate } from '@/composables/usePwaUpdate';
import { useAutoActions } from '@/composables/useAutoActions';
import { useAppBootstrap } from '@/composables/useAppBootstrap';
import { useDocumentTitle } from '@/composables/useDocumentTitle';
import { useTrackEndOnVisibility } from '@/composables/useTrackEndOnVisibility';
import { syncService } from '@/services/download/SyncService';
import { getPageTitle } from '@/navigation/title';
import { TOP_BAR_ITEMS, type MenuItem } from '@/navigation/menu';
import PlayerControls from '@/components/player/PlayerControls.vue';
import FullPlayer from '@/components/player/FullPlayer.vue';
import ModalHost from '@/components/ui/ModalHost.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import SyncIssuesModal from '@/components/library/SyncIssuesModal.vue';
import SpacePermissionModal from '@/components/download/SpacePermissionModal.vue';
import AppDrawer from '@/components/layout/AppDrawer.vue';
import FeedbackModal from '@/components/ui/FeedbackModal.vue';
import AppLoader from '@/components/layout/AppLoader.vue';
import IconButton from '@/components/ui/IconButton.vue';
import Icon from '@/components/ui/Icon.vue';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import type { PlaylistId } from '@/types/ids';
import { useClipboardWatcher } from './composables/useClipboardWatcher';

const route = useRoute();
const player = usePlayerStore();
const library = useLibraryStore();
const playlists = usePlaylistsStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const isFullPlayerOpen = ref(false);
const isDrawerOpen = ref(false);
const showSyncIssues = ref(false);
const isFeedbackOpen = ref(false);

const { isBootstrapping } = useAppBootstrap();

usePwaUpdate();
useAutoActions();
useDocumentTitle(currentTrack);
useTrackEndOnVisibility();
useClipboardWatcher();

function openFullPlayer() {
  isFullPlayerOpen.value = true;
}
function closeFullPlayer() {
  isFullPlayerOpen.value = false;
}
function openDrawer() {
  isDrawerOpen.value = true;
}
function closeDrawer() {
  isDrawerOpen.value = false;
}
function openFeedback() {
  isFeedbackOpen.value = true;
}
function closeFeedback() {
  isFeedbackOpen.value = false;
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullPlayerOpen.value) closeFullPlayer();
}

const pageTitle = computed(() =>
  getPageTitle(route, {
    folderName: library.currentFolder?.name ?? null,
    playlistName: (() => {
      if (route.name !== 'playlist') return null;
      const id = String(route.params.id ?? '') as PlaylistId;
      return playlists.getPlaylist(id)?.name ?? null;
    })(),
  }),
);

watch(
  () => route.fullPath,
  () => {
    if (isFullPlayerOpen.value) isFullPlayerOpen.value = false;
  },
);
watch(
  () => syncService.issueCount.value,
  (count) => {
    if (count > 0) showSyncIssues.value = true;
  },
);

useKeyboardShortcuts({
  onToggle: () => player.toggle(),
  onToggleMute: () => player.toggleMute(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeekBy: (delta) => player.seekBy(delta),
  onVolumeBy: (delta) => player.setVolumeBy(delta),
});

useMediaSession({
  currentTrack,
  isPlaying,
  onPlay: () => player.play(),
  onPause: () => player.pause(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeek: (t) => player.seek(t),
  onSeekBy: (d) => player.seekBy(d),
});

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

const isSpacePermissionModalOpen = ref(downloadSpaceService.needsPermission.value);
watch(
  () => downloadSpaceService.needsPermission.value,
  (need) => {
    if (need) isSpacePermissionModalOpen.value = true;
  },
);
function closeSpacePermissionModal() {
  isSpacePermissionModalOpen.value = false;
}

function isTopBarItemActive(item: MenuItem): boolean {
  if (item.route === 'playlist' && item.params?.id === 'playlist:favorites') {
    return route.name === 'playlist' && route.params.id === 'playlist:favorites';
  }
  return route.name === item.route;
}
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-bg text-fg relative">
    <!-- ШАПКА -->
    <header class="app-safe-top flex items-center justify-between gap-2 px-3 py-2 z-10">
      <!-- Слева: Бургер -->
      <div class="flex items-center gap-2">
        <IconButton icon="menu" variant="ghost" size="md" label="Меню" @click="openDrawer" class="!px-3 !w-auto">
          <span class="hidden md:inline text-sm">Меню</span>
        </IconButton>
      </div>

      <!-- По центру / Слева: Название -->
      <span v-if="syncService.isSyncing.value" class="text-xs text-fg-muted">Синхронизация…</span>
      <span v-else-if="library.currentFolder" class="hidden md:inline truncate text-sm text-fg-muted">
        {{ library.currentFolder.name }}
      </span>
      <div class="flex-1"></div>

      <!-- Справа: Иконки верхнего меню -->
      <div class="flex items-center gap-1">
        <RouterLink
          v-for="item in TOP_BAR_ITEMS"
          :key="item.label"
          :to="{ name: item.route, params: item.params }"
          class="flex h-9 items-center gap-1.5 rounded-btn px-2 text-sm transition"
          :class="
            isTopBarItemActive(item) ? 'bg-active/10 text-active' : 'text-fg-muted hover:bg-hover-bg hover:text-fg'
          "
          v-tooltip="item.label"
        >
          <Icon :name="item.icon" w="w-5" h="h-5" />
          <span class="hidden md:inline">{{ item.label }}</span>
        </RouterLink>
      </div>
    </header>

    <!-- КОНТЕНТ -->
    <main class="overflow-hidden z-10 relative">
      <RouterView v-if="!isBootstrapping" />
      <AppLoader v-else />
    </main>

    <!-- ПЛЕЕР -->
    <div class="z-20 relative">
      <PlayerControls @open="openFullPlayer" />
    </div>

    <!-- МОДАЛКИ -->
    <ModalHost />
    <ToastHost />
    <SyncIssuesModal v-if="showSyncIssues" @close="showSyncIssues = false" />
    <SpacePermissionModal v-if="isSpacePermissionModalOpen" @close="closeSpacePermissionModal" />
    <FeedbackModal v-if="isFeedbackOpen" @close="closeFeedback" />

    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <FullPlayer v-if="isFullPlayerOpen" :title="pageTitle" @close="closeFullPlayer" />
    </Transition>

    <AppDrawer :open="isDrawerOpen" @close="closeDrawer" @open-feedback="openFeedback" />
  </div>
</template>
