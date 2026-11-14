<!-- src/plugins/yandexSelf/logii/LogiiGallery.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue';
import Icon from '@/components/atoms/Icon.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { toastService } from '@/services/ui/ToastService';
import { yandexSelfService } from '../YandexSelfService';
import { markPendingDelete } from './composables/useLogiiChanges';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { LogiiTrackItem } from './useLogiiData';
import type { FolderFile } from '@/types/folder';
import { logger } from '@/utils/logger';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const props = defineProps<{
  folder: LogiiTrackItem;
  images: FolderFile[];
}>();

const fullscreenIndex = ref<number | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const uploadProgress = ref({ done: 0, total: 0 });
const deletingIndex = ref<number | null>(null);

const isFullscreen = computed(() => fullscreenIndex.value !== null);

function openImage(index: number): void {
  fullscreenIndex.value = index;
}

function closeFullscreen(): void {
  fullscreenIndex.value = null;
}

function next(): void {
  if (fullscreenIndex.value === null) return;
  fullscreenIndex.value = (fullscreenIndex.value + 1) % props.images.length;
}

function prev(): void {
  if (fullscreenIndex.value === null) return;
  fullscreenIndex.value = (fullscreenIndex.value - 1 + props.images.length) % props.images.length;
}

function currentUrl(): string | null {
  if (fullscreenIndex.value === null) return null;
  return props.images[fullscreenIndex.value]?.url ?? null;
}

function onKeydown(e: KeyboardEvent): void {
  if (!isFullscreen.value) return;
  if (e.key === 'Escape') closeFullscreen();
  else if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
}

window.addEventListener('keydown', onKeydown);

// --- Upload ---

function triggerUpload(): void {
  if (isUploading.value) return;
  fileInputRef.value?.click();
}

async function onFilesSelected(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const fileList = target.files;
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList);
  target.value = '';

  // Клиентская проверка размера до отправки.
  const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
  if (tooBig) {
    toastService.error(`Файл «${tooBig.name}» больше 8 МБ`);
    return;
  }

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
        logger.warn(`[logii-gallery] upload failed for "${file.name}"`, err);
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
      toastService.success(`Загружено картинок: ${uploaded}`);
    }
  } finally {
    isUploading.value = false;
    uploadProgress.value = { done: 0, total: 0 };
  }
}

// --- Delete ---

async function onDeleteImage(index: number, e: MouseEvent): Promise<void> {
  e.stopPropagation();
  if (deletingIndex.value !== null) return;

  const image = props.images[index];
  if (!image || !props.folder.urlPath) return;

  const confirmed = window.confirm(`Удалить картинку «${image.name}» с Яндекс.Диска?`);
  if (!confirmed) return;

  deletingIndex.value = index;

  try {
    const remotePath = `${props.folder.urlPath}/${image.name}`;
    // CUEI-0022: штатное удаление картинки не должно попадать в removed-события
    markPendingDelete(remotePath);
    await yandexSelfService.removeResource(remotePath);

    const plugin = await loadPlugin('yandex-self');
    if (plugin.scanFolder) {
      const context = createPluginContext('yandex-self');
      await plugin.scanFolder(context, props.folder.folderId, { recursive: false, force: true });
    }

    toastService.success('Картинка удалена');
  } catch (err) {
    logger.error('[logii-gallery] delete failed', err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось удалить');
  } finally {
    deletingIndex.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-fg-muted">Картинки</p>
      <button
        type="button"
        class="rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50"
        :disabled="isUploading"
        data-testid="logii-gallery-upload-trigger"
        @click="triggerUpload"
      >
        <Spinner v-if="isUploading" size="sm" />
        <template v-else>
          <Icon name="plus" w="w-3.5" h="h-3.5" class="mr-1 inline" />
          Загрузить картинки
        </template>
        <span v-if="isUploading" class="ml-1">{{ uploadProgress.done }} / {{ uploadProgress.total }}</span>
      </button>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        data-testid="logii-gallery-upload-input"
        @change="onFilesSelected"
      />
    </div>

    <div v-if="images.length === 0" class="py-8 text-center text-xs text-fg-muted">Картинок нет.</div>

    <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      <div
        v-for="(img, index) in images"
        :key="img.urlPath"
        class="group relative aspect-square overflow-hidden rounded-card bg-card-bg"
        :data-testid="`logii-gallery-image-${index}`"
      >
        <button
          type="button"
          class="h-full w-full transition hover:opacity-90"
          :aria-label="`Открыть ${img.name}`"
          @click="openImage(index)"
        >
          <img
            v-if="img.url"
            :src="img.url"
            :alt="img.name"
            class="h-full w-full object-cover transition group-hover:scale-105"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <Icon v-else name="image" w="w-8" h="h-8" class="text-fg-subtle" />
        </button>

        <div class="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
          <IconButton
            icon="trash"
            variant="danger"
            size="sm"
            label="Удалить картинку"
            :disabled="deletingIndex !== null"
            :data-testid="`logii-gallery-delete-${index}`"
            @click="onDeleteImage(index, $event)"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isFullscreen"
          class="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
          data-testid="logii-gallery-fullscreen"
          @click.self="closeFullscreen"
        >
          <IconButton
            icon="arrow-left"
            variant="ghost"
            size="lg"
            label="Назад"
            class="absolute left-4 top-4 !text-white"
            data-testid="logii-gallery-close"
            @click="closeFullscreen"
          />

          <button
            v-if="images.length > 1"
            type="button"
            class="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Предыдущая"
            @click="prev"
          >
            <Icon name="chevron-left" w="w-6" h="w-6" />
          </button>

          <img
            v-if="currentUrl()"
            :src="currentUrl()!"
            :alt="images[fullscreenIndex!]?.name ?? ''"
            class="max-h-[90vh] max-w-[90vw] object-contain"
            data-testid="logii-gallery-fullscreen-image"
            @click.stop
          />

          <button
            v-if="images.length > 1"
            type="button"
            class="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Следующая"
            @click="next"
          >
            <Icon name="chevron-right" w="w-6" h="w-6" />
          </button>

          <p class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
            {{ (fullscreenIndex ?? 0) + 1 }} / {{ images.length }}
          </p>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
