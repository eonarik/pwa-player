<!-- src/views/PlaylistRoute.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlaylistsStore } from '@/stores/playlists';
import { useLibraryStore } from '@/stores/library';
import { FAVORITES_PLAYLIST_ID } from '@/types/collection';
import PlaylistHeader from './playlist/PlaylistHeader.vue';
import TrackListPage from '@/components/library/TrackListPage.vue';
import type { Track } from '@/types/track';

const route = useRoute();
const router = useRouter();
const playlists = usePlaylistsStore();
const library = useLibraryStore();

const playlistId = computed(() => String(route.params.id ?? ''));
const playlist = computed(() => playlists.getPlaylist(playlistId.value as never));
const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID);

const resolvedTracks = computed<Track[]>(() => {
  if (!playlist.value) return [];
  return playlist.value.trackIds.map((id) => library.getTrack(id)).filter((t): t is Track => Boolean(t));
});

const unavailableCount = computed(() => {
  if (!playlist.value) return 0;
  return playlist.value.trackIds.length - resolvedTracks.value.length;
});

function onRename(value: string): void {
  if (!playlist.value) return;
  playlists.renamePlaylist(playlist.value.id, value);
}

function onDelete(): void {
  if (!playlist.value || isFavorites.value) return;
  const confirmed = window.confirm(`Удалить плейлист «${playlist.value.name}»?`);
  if (!confirmed) return;
  playlists.deletePlaylist(playlist.value.id);
  router.replace({ name: 'playlists' });
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div v-if="!playlist" class="flex h-full flex-col items-center justify-center gap-3 text-sm text-fg-muted">
      <p>Плейлист не найден</p>
      <RouterLink
        :to="{ name: 'playlists' }"
        class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover"
      >
        К плейлистам
      </RouterLink>
    </div>

    <template v-else>
      <TrackListPage
        :title="playlist.name"
        :subtitle="`${resolvedTracks.length} из ${playlist.trackIds.length}`"
        :tracks="resolvedTracks"
        :show-search="true"
        :show-filter="true"
        :show-play-all="true"
        :show-batch-add="true"
      >
        <template #header-actions>
          <PlaylistHeader
            :playlist="playlist"
            :is-favorites="isFavorites"
            :resolved-tracks="resolvedTracks"
            :unavailable-count="unavailableCount"
            @rename="onRename"
            @delete="onDelete"
          />
        </template>
      </TrackListPage>
    </template>
  </div>
</template>
