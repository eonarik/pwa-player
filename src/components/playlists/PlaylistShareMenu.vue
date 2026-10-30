<!-- src/components/playlists/PlaylistShareMenu.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import IconButton from '@/components/ui/IconButton.vue';
import { toastService } from '@/services/ui/ToastService';
import { exportToM3U, exportToJSON } from '@/utils/playlistParser';
import { downloadTextFile } from '@/utils/downloadFile';
import type { Playlist, PlaylistExportTrack } from '@/types/collection';

const props = defineProps<{
  playlist: Playlist;
}>();

const library = useLibraryStore();

const exportTracks = computed<PlaylistExportTrack[]>(() => {
  return props.playlist.trackIds.map((id) => {
    const track = library.getTrack(id);
    const album = track?.albumId ? library.getAlbum(track.albumId) : null;
    return {
      artist: track?.artist || '',
      title: track?.title || 'Unknown Title',
      album: album?.name,
      duration: track?.duration,
      path: undefined,
    };
  });
});

function onExportM3U(close: () => void) {
  if (exportTracks.value.length === 0) {
    toastService.error('Плейлист пуст');
    return;
  }
  const content = exportToM3U(exportTracks.value);
  const safeName = props.playlist.name.replace(/[^a-zа-яё0-9\s_-]/gi, '').trim() || 'playlist';
  downloadTextFile(`${safeName}.m3u`, content, 'audio/x-mpegurl');
  toastService.success('Плейлист экспортирован в M3U');
  close();
}

function onExportJSON(close: () => void) {
  if (exportTracks.value.length === 0) {
    toastService.error('Плейлист пуст');
    return;
  }
  const content = exportToJSON(props.playlist.name, exportTracks.value);
  const safeName = props.playlist.name.replace(/[^a-zа-яё0-9\s_-]/gi, '').trim() || 'playlist';
  downloadTextFile(`${safeName}.json`, content, 'application/json');
  toastService.success('Плейлист экспортирован в JSON');
  close();
}
</script>

<template>
  <DropdownMenu :width="256">
    <template #trigger="{ toggle, setTriggerRef }">
      <div :ref="setTriggerRef" @click.stop="toggle">
        <IconButton icon="share" label="Поделиться" />
      </div>
    </template>

    <template #default="{ close }">
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        @click="onExportM3U(close)"
      >
        Экспорт в M3U
        <span class="block text-[10px] text-fg-muted">Для VLC, MusicBee и других плееров</span>
      </button>

      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        @click="onExportJSON(close)"
      >
        Экспорт в JSON
        <span class="block text-[10px] text-fg-muted">Нативный формат CUEI (с метаданными)</span>
      </button>
    </template>
  </DropdownMenu>
</template>
