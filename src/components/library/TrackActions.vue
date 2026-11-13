<!-- src/components/library/TrackActions.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import { usePlaylistsStore } from '@/stores/playlists';
import { toPlaylistId } from '@/types/ids';
import type { Track } from '@/types/track';
import TrackReactionButtons from '../ui/TrackReactionButtons.vue';
import DropdownMenu from '@/components/molecules/DropdownMenu.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import PlaylistSubmenu from './PlaylistSubmenu.vue';
import Divider from '../atoms/Divider.vue';
import TrackMetadataMenu from './TrackMetadataMenu.vue';
import TrackDownloadItem from './TrackDownloadItem.vue';
import { useTrackCapabilities } from '@/composables/useTrackCapabilities';
import { useTrackMetadataActions } from '@/composables/useTrackMetadataActions';
import { useTrackDownloadAction } from '@/composables/useTrackDownloadAction';

const props = defineProps<{
  track: Track;
  playlistId?: string;
  queueIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'removed-from-playlist'): void;
  (e: 'removed-from-queue'): void;
}>();

const playlists = usePlaylistsStore();

const track = computed(() => props.track);

const { isLinear, isLive, isStreaming, canDownload } = useTrackCapabilities(track);

const {
  isSearchingMetadata,
  hasMetadataEdits,
  libraryTrack,
  candidateCount,
  openMetadataEditor,
  openCandidates,
  removeMetadata,
  findMetadata,
} = useTrackMetadataActions(track, { isStreaming });

const { isDownloading, isDownloaded, downloadLabel, onDownload } = useTrackDownloadAction(track, libraryTrack);

function removeFromPlaylist(close: () => void): void {
  const playlistId = toPlaylistId(props.playlistId);
  if (!playlistId) return;
  playlists.removeTrackFromPlaylist(playlistId, props.track.id);
  emit('removed-from-playlist');
  close();
}

function removeFromQueue(close: () => void): void {
  if (props.queueIndex === undefined) return;
  emit('removed-from-queue');
  close();
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <TrackReactionButtons v-if="!isLive && !isLinear" :track="track" size="sm" dislike-mode="toggle" />

    <DropdownMenu :width="256">
      <template #trigger="{ toggle, setTriggerRef }">
        <div :ref="setTriggerRef">
          <IconButton icon="dots" label="Действия" data-testid="track-actions-trigger" @click="toggle" />
        </div>
      </template>

      <template #default="{ close }">
        <template v-if="!isLive">
          <PlaylistSubmenu :tracks="[track]" in-dropdown @close="close" />
          <Divider />
        </template>

        <TrackMetadataMenu
          :is-live="isLive"
          :is-linear="isLinear"
          :is-searching="isSearchingMetadata"
          :has-metadata-edits="hasMetadataEdits"
          :is-streaming="isStreaming"
          :candidate-count="candidateCount"
          @find="findMetadata(close)"
          @edit="openMetadataEditor(close)"
          @remove="removeMetadata(close)"
          @candidates="openCandidates(close)"
        />

        <button
          v-if="playlistId"
          type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          data-testid="track-action-remove-from-playlist"
          @click="removeFromPlaylist(close)"
        >
          Убрать из плейлиста
        </button>

        <button
          v-if="queueIndex !== undefined"
          type="button"
          class="block w-full px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-hover-bg"
          data-testid="track-action-remove-from-queue"
          @click="removeFromQueue(close)"
        >
          Убрать из очереди
        </button>

        <TrackDownloadItem
          v-if="canDownload"
          :is-known="libraryTrack !== null"
          :is-downloaded="isDownloaded"
          :is-downloading="isDownloading"
          :label="downloadLabel"
          @click="onDownload(close)"
        />
      </template>
    </DropdownMenu>
  </div>
</template>
