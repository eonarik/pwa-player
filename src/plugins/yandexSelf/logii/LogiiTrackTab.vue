<!-- src/plugins/yandexSelf/logii/LogiiTrackTab.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { createLibraryWriter } from '@/stores/library';
import TrackListItem from '@/components/library/TrackListItem.vue';
import TrackActions from '@/components/library/TrackActions.vue';
import Icon from '@/components/atoms/Icon.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { toastService } from '@/services/ui/ToastService';
import { modalService } from '@/services/ui/ModalService';
import { yandexSelfService } from '../YandexSelfService';
import { markPendingDelete } from './composables/useLogiiChanges';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import LogiiVibeBlock from './LogiiVibeBlock.vue';
import StreamSearchModal from './StreamSearchModal.vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';
import type { Track } from '@/types/track';
import { logger } from '@/utils/logger';

const props = defineProps<{
  folder: LogiiTrackItem;
  data: LogiiData | null;
  isLoadingVibe: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  updateVibe: (text: string) => Promise<boolean>;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref({ done: 0, total: 0 });
const deletingTrackId = ref<string | null>(null);

const tracks = computed(() => props.folder.audioTracks);

const vibeTitle = computed(() => 'Vibe');

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId;
}

// --- Загрузка треков ---

function triggerFilePicker(): void {
  if (isUploading.value) return;
  fileInputRef.value?.click();
}

async function onFilesSelected(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const fileList = target.files;
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);
  target.value = '';

  if (!props.folder.urlPath) return;

  isUploading.value = true;
  uploadProgress.value = { done: 0, total: files.length };

  let uploaded = 0;
  let failed = 0;

  try {
    for (const file of files) {
      try {
        await yandexSelfService.uploadFile(props.folder.urlPath, file.name, file);
        uploaded++;
      } catch (err) {
        logger.warn(`[logii] upload failed for "${file.name}"`, err);
        failed++;
      } finally {
        uploadProgress.value = {
          done: uploadProgress.value.done + 1,
          total: files.length,
        };
      }
    }

    const plugin = await loadPlugin('yandex-self');
    if (plugin.scanFolder) {
      const context = createPluginContext('yandex-self');
      await plugin.scanFolder(context, props.folder.folderId, { recursive: false, force: true });
    }

    if (failed > 0) {
      toastService.error(`Загружено: ${uploaded}, ошибок: ${failed}`);
    } else if (uploaded > 0) {
      toastService.success(`Загружено треков: ${uploaded}`);
    }
  } finally {
    isUploading.value = false;
    uploadProgress.value = { done: 0, total: 0 };
  }
}

// --- Поиск в стриминговых провайдерах (CUEI-0005) ---

const takenNames = computed(() => {
  const names = new Set<string>();
  for (const t of props.folder.audioTracks) {
    for (const src of t.sources) {
      if (src.kind === 'cloud' && src.pluginId === 'yandex-self') {
        const fileName = src.remotePath.split('/').pop();
        if (fileName) names.add(fileName);
      }
    }
  }
  for (const f of props.folder.imageFiles) {
    names.add(f.name);
  }
  return Array.from(names);
});

async function openStreamSearch(): Promise<void> {
  await modalService.show<null>({
    title: 'Найти в стримингах',
    type: 'custom',
    component: StreamSearchModal,
    props: {
      folderUrlPath: props.folder.urlPath,
      takenNames: takenNames.value,
      onUpload: async (fileName: string, blob: Blob) => {
        await uploadBlobToFolder(fileName, blob);
      },
    },
    disableBackdropClose: true,
  });
}

async function uploadBlobToFolder(fileName: string, blob: Blob): Promise<void> {
  if (!props.folder.urlPath) return;

  const file = new File([blob], fileName, { type: 'audio/mpeg' });
  await yandexSelfService.uploadFile(props.folder.urlPath, fileName, file);

  // Rescan folder to pick up the new track
  const plugin = await loadPlugin('yandex-self');
  if (plugin.scanFolder) {
    const context = createPluginContext('yandex-self');
    await plugin.scanFolder(context, props.folder.folderId, { recursive: false, force: true });
  }

  toastService.success(`Трек «${fileName}» добавлен`);
}

// --- Удаление трека ---

function getRemotePath(track: Track): string | null {
  for (const src of track.sources) {
    if (src.kind === 'cloud' && src.pluginId === 'yandex-self') {
      return src.remotePath;
    }
  }
  return null;
}

async function onDeleteTrack(track: Track): Promise<void> {
  if (deletingTrackId.value) return;

  const remotePath = getRemotePath(track);
  if (!remotePath) {
    toastService.error('Не удалось определить путь на Диске');
    return;
  }

  const confirmed = window.confirm(`Удалить трек «${track.title}» с Яндекс.Диска? Это действие необратимо.`);
  if (!confirmed) return;

  deletingTrackId.value = track.id;

  try {
    // CUEI-0022: штатное удаление трека не должно попадать в removed-события
    markPendingDelete(remotePath);

    await yandexSelfService.removeResource(remotePath);

    const source = track.sources.find(
      (s) => s.kind === 'cloud' && s.pluginId === 'yandex-self' && s.remotePath === remotePath,
    );
    if (source) {
      const writer = createLibraryWriter();
      await writer.removeTrackSource(track.id, source.id);
    }

    toastService.success('Трек удалён');
  } catch (err) {
    logger.error('[logii] delete track failed', err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось удалить трек');
  } finally {
    deletingTrackId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Шапка "Аудио" — всегда видна -->
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-sm font-medium text-fg">Аудио</p>
        <div class="flex items-center gap-2">
          <button
            v-if="isEditMode"
            type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isUploading"
            data-testid="logii-upload-trigger"
            @click="triggerFilePicker"
          >
            <Spinner v-if="isUploading" size="sm" />
            <template v-else>
              <Icon name="plus" w="w-3.5" h="h-3.5" class="mr-1 inline" />
              Загрузить треки
            </template>
            <span v-if="isUploading" class="ml-1">{{ uploadProgress.done }} / {{ uploadProgress.total }}</span>
          </button>
          <button
            v-if="isEditMode"
            type="button"
            class="rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isUploading"
            data-testid="logii-stream-search"
            @click="openStreamSearch"
          >
            <Icon name="search" w="w-3.5" h="h-3.5" class="mr-1 inline" />
            Найти в стримингах
          </button>
          <button
            v-if="tracks.length > 0"
            type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="isUploading"
            data-testid="logii-play-all"
            @click="props.onPlayAll()"
          >
            <Icon name="play" w="w-3.5" h="h-3.5" class="mr-1 inline" />
            Играть всё
          </button>
        </div>
      </div>

      <div v-if="tracks.length > 0" class="flex flex-col gap-0.5">
        <TrackListItem
          v-for="(track, index) in tracks"
          :key="track.id"
          :track="track"
          :index="index"
          :is-current="isCurrent(track.id)"
          :is-playing="isPlaying"
          @select="() => props.onPlayTrack(index)"
        >
          <template #actions>
            <button
              v-if="isEditMode && getRemotePath(track)"
              type="button"
              class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              :disabled="deletingTrackId !== null"
              aria-label="Удалить трек с Диска"
              :data-testid="`logii-delete-track-${track.id}`"
              v-tooltip="'Удалить с Диска'"
              @click.stop="onDeleteTrack(track)"
            >
              <Spinner v-if="deletingTrackId === track.id" size="sm" />
              <Icon v-else name="trash" w="w-4" h="h-4" />
            </button>
            <TrackActions :track="track" />
          </template>
        </TrackListItem>
      </div>

      <p v-else class="text-xs text-fg-muted">Нет аудио в этой папке.</p>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*"
      multiple
      class="hidden"
      data-testid="logii-upload-input"
      @change="onFilesSelected"
    />

    <LogiiVibeBlock
      :vibe="data?.vibe ?? ''"
      :title="vibeTitle"
      :is-loading="isLoadingVibe"
      :is-saving="isSaving"
      :is-edit-mode="isEditMode"
      :on-update-vibe="updateVibe"
    />
  </div>
</template>
