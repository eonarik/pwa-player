<!-- src/plugins/yandexSelf/logii/LogiiTrackTab.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { createLibraryWriter } from '@/stores/library';
import TrackListItem from '@/components/library/TrackListItem.vue';
import TrackActions from '@/components/library/TrackActions.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { toastService } from '@/services/ui/ToastService';
import { yandexSelfService } from '../YandexSelfService';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';
import type { Track } from '@/types/track';

const props = defineProps<{
  folder: LogiiTrackItem;
  data: LogiiData | null;
  isLoadingVibe: boolean;
  isSaving: boolean;
  updateVibe: (text: string) => Promise<boolean>;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const isEditingVibe = ref(false);
const vibeDraft = ref('');
const vibeTextareaRef = ref<HTMLTextAreaElement | null>(null);

const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref({ done: 0, total: 0 });
const deletingTrackId = ref<string | null>(null);

const VIBE_MIN_ROWS = 1;
const VIBE_MAX_ROWS = 10;

const currentVibe = computed(() => props.data?.vibe ?? '');
const tracks = computed(() => props.folder.audioTracks);

const vibeTitle = computed(() => {
  if (props.folder.isIntro && props.folder.logiiFileName) {
    return props.folder.logiiFileName;
  }
  return 'Vibe';
});

// --- Vibe ---

function autosizeVibe(): void {
  const el = vibeTextareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const rows = Math.max(VIBE_MIN_ROWS, Math.min(VIBE_MAX_ROWS, Math.ceil(el.scrollHeight / lineHeight)));
  const height = rows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  el.style.height = `${height}px`;
  el.style.overflowY = rows >= VIBE_MAX_ROWS ? 'auto' : 'hidden';
}

function startEdit(): void {
  vibeDraft.value = currentVibe.value;
  isEditingVibe.value = true;
  nextTick(() => autosizeVibe());
}

function cancelEdit(): void {
  isEditingVibe.value = false;
  vibeDraft.value = '';
}

async function saveVibe(): Promise<void> {
  const ok = await props.updateVibe(vibeDraft.value);
  if (ok) isEditingVibe.value = false;
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId;
}

watch(
  () => isEditingVibe.value,
  (editing) => {
    if (editing) nextTick(() => autosizeVibe());
  },
);

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
        console.warn(`[logii] upload failed for "${file.name}"`, err);
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
      await plugin.scanFolder(context, props.folder.folderId as never, { recursive: false, force: true });
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
    console.error('[logii] delete track failed', err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось удалить трек');
  } finally {
    deletingTrackId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Шапка "Аудио" — всегда видна, если folder есть -->
    <div>
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-sm font-medium text-fg">Аудио</p>
        <div class="flex items-center gap-2">
          <button
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

      <!-- Список треков -->
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
              v-if="getRemotePath(track)"
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

    <!-- <input type="file"> — ВСЕГДА в DOM, вне v-if="tracks.length > 0" -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*"
      multiple
      class="hidden"
      data-testid="logii-upload-input"
      @change="onFilesSelected"
    />

    <!-- Vibe -->
    <div class="rounded-card bg-card-bg p-4">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-fg">{{ vibeTitle }}</p>
        <button
          v-if="!isEditingVibe && !isLoadingVibe"
          type="button"
          class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          data-testid="logii-vibe-edit"
          @click="startEdit"
        >
          <Icon name="pencil" w="w-3.5" h="h-3.5" class="mr-1 inline" />
          {{ currentVibe ? 'Редактировать' : 'Написать' }}
        </button>
      </div>

      <div v-if="isLoadingVibe" class="flex items-center gap-2 text-xs text-fg-muted">
        <Spinner size="sm" />
        Загружаем Vibe…
      </div>

      <template v-else-if="isEditingVibe">
        <textarea
          ref="vibeTextareaRef"
          v-model="vibeDraft"
          :rows="VIBE_MIN_ROWS"
          class="w-full rounded-btn bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none"
          placeholder="Опиши вайб трека…"
          data-testid="logii-vibe-textarea"
          @input="autosizeVibe"
        />
        <div class="mt-2 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-btn px-3 py-1 text-xs text-fg-muted hover:text-fg"
            data-testid="logii-vibe-cancel"
            @click="cancelEdit"
          >
            Отмена
          </button>
          <button
            type="button"
            class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
            :disabled="isSaving"
            data-testid="logii-vibe-save"
            @click="saveVibe"
          >
            {{ isSaving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </div>
      </template>

      <p v-else-if="currentVibe" class="whitespace-pre-line text-sm text-fg">{{ currentVibe }}</p>
      <p v-else class="text-xs text-fg-muted">
        Vibe пока нет. Напиши первый комментарий — файл создастся автоматически.
      </p>
    </div>
  </div>
</template>
