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
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import type { PlaylistId } from '@/types/ids';

const route = useRoute();
const player = usePlayerStore();
const library = useLibraryStore();
const playlists = usePlaylistsStore();
const { currentTrack, isPlaying, queue } = storeToRefs(player);

const isFullPlayerOpen = ref(false);
const isDrawerOpen = ref(false);
const showSyncIssues = ref(false);
const isFeedbackOpen = ref(false);

const { isBootstrapping } = useAppBootstrap();

usePwaUpdate();
useAutoActions();
useDocumentTitle(currentTrack);
useTrackEndOnVisibility();

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
  if (e.key === 'Escape' && isFullPlayerOpen.value) {
    closeFullPlayer();
  }
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

const queueBadge = computed(() => (queue.value.length > 0 ? String(queue.value.length) : ''));

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

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-bg text-fg relative">
    <header class="app-safe-top flex items-center gap-2 px-3 py-2 z-10">
      <IconButton icon="menu" variant="ghost" size="md" label="Меню" @click="openDrawer" class="!px-3 !w-auto">
        <span class="hidden md:inline text-sm">Меню</span>
        <span
          v-if="queueBadge"
          class="ml-0.5 rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active"
        >
          {{ queueBadge }}
        </span>
      </IconButton>

      <span v-if="syncService.isSyncing.value" class="text-xs text-fg-muted">Синхронизация…</span>
      <span v-else-if="library.currentFolder" class="ml-2 truncate text-sm text-fg-muted">
        {{ library.currentFolder.name }}
      </span>
    </header>

    <main class="overflow-hidden z-10 relative">
      <RouterView v-if="!isBootstrapping" />
      <AppLoader v-else />
    </main>

    <div class="z-20 relative">
      <PlayerControls @open="openFullPlayer" />
    </div>

    <ModalHost />
    <ToastHost />
    <SyncIssuesModal v-if="showSyncIssues" @close="showSyncIssues = false" />
    <SpacePermissionModal v-if="downloadSpaceService.needsPermission.value" />
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
