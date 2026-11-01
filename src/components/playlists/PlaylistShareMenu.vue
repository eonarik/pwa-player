<!-- src/components/playlists/PlaylistShareMenu.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import IconButton from '@/components/ui/IconButton.vue';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import { toastService } from '@/services/ui/ToastService';
import { exportToM3U, exportToJSON } from '@/utils/playlistParser';
import { downloadTextFile } from '@/utils/downloadFile';
import { encodeBlueprint, type BlueprintData, type BlueprintTrack } from '@/utils/playlistBlueprint';
import type { Playlist, PlaylistExportTrack } from '@/types/collection';

const props = defineProps<{ playlist: Playlist }>();

const library = useLibraryStore();
const isOpen = ref(false);
const isEncoding = ref(false);
const isShowStringOpen = ref(false);
const encodedString = ref<string | null>(null);

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

const blueprintData = computed<BlueprintData>(() => {
  const tr: BlueprintTrack[] = exportTracks.value.map((t) => {
    const item: BlueprintTrack = { a: t.artist, t: t.title };
    if (t.album) item.al = t.album;
    if (t.duration) item.d = Math.round(t.duration);
    return item;
  });
  return { n: props.playlist.name, tr };
});

const canShare = computed(() => typeof navigator !== 'undefined' && !!navigator.share);

async function getEncodedString(): Promise<string | null> {
  if (encodedString.value) return encodedString.value;
  if (exportTracks.value.length === 0) return null;
  try {
    isEncoding.value = true;
    encodedString.value = await encodeBlueprint(blueprintData.value);
    return encodedString.value;
  } catch {
    toastService.error('Не удалось подготовить строку');
    return null;
  } finally {
    isEncoding.value = false;
  }
}

function suppressWatcherFor(text: string) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33) ^ text.charCodeAt(i);
  sessionStorage.setItem('cuei:lastClipboardHash', (hash >>> 0).toString(16));
}

async function onPrimaryAction() {
  if (exportTracks.value.length === 0) {
    toastService.error('Плейлист пуст');
    return;
  }
  const str = await getEncodedString();
  if (!str) return;

  const shareText = `Слушай мой плейлист «${props.playlist.name}» в CUEI!\n\nВставь этот код в приложении:\n${str}`;

  if (window.navigator.share) {
    try {
      await window.navigator.share({
        title: `Плейлист «${props.playlist.name}»`,
        text: shareText,
      });
      isOpen.value = false;
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('Share failed', err);
    }
  }

  // Фоллбэк
  try {
    await window.navigator.clipboard.writeText(str);
    suppressWatcherFor(str);
    toastService.success('Код скопирован в буфер обмена!');
    isOpen.value = false;
  } catch {
    isShowStringOpen.value = true;
  }
}

async function onCopy() {
  if (exportTracks.value.length === 0) {
    toastService.error('Плейлист пуст');
    return;
  }
  const str = await getEncodedString();
  if (!str) return;

  try {
    await window.navigator.clipboard.writeText(str);
    suppressWatcherFor(str);
    toastService.success('Код скопирован в буфер обмена!');
    isOpen.value = false;
  } catch {
    isShowStringOpen.value = true;
  }
}

function onDownloadFile(format: 'm3u' | 'json') {
  if (exportTracks.value.length === 0) {
    toastService.error('Плейлист пуст');
    return;
  }
  const safeName = props.playlist.name.replace(/[^a-zа-яё0-9\s_-]/gi, '').trim() || 'playlist';

  if (format === 'm3u') {
    downloadTextFile(`${safeName}.m3u`, exportToM3U(exportTracks.value), 'audio/x-mpegurl');
  } else {
    downloadTextFile(`${safeName}.json`, exportToJSON(props.playlist.name, exportTracks.value), 'application/json');
  }
  toastService.success('Файл скачан');
  isOpen.value = false;
}

function copyFromModal() {
  if (!encodedString.value) return;
  suppressWatcherFor(encodedString.value);
  window.navigator.clipboard.writeText(encodedString.value).then(() => {
    toastService.success('Скопировано');
    isShowStringOpen.value = false;
  });
}
</script>

<template>
  <div class="flex items-center gap-2">
    <IconButton icon="share" label="Поделиться плейлистом" @click="isOpen = true" />

    <ModalLayout v-if="isOpen" title="Поделиться плейлистом" max-width="md" @close="isOpen = false">
      <div class="flex flex-col gap-3">
        <p class="text-sm text-fg-muted mb-2">Отправьте плейлист другу:</p>

        <button
          v-if="canShare"
          type="button"
          class="flex items-center gap-4 rounded-btn bg-card-bg p-4 text-left transition hover:bg-hover-bg"
          @click="onPrimaryAction"
        >
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-active/20 text-active">
            <Icon name="share" w="w-5" h="w-5" />
          </div>
          <div>
            <p class="text-sm font-medium text-fg">Переслать в соцсети</p>
            <p class="text-xs text-fg-muted">Откроется системное меню (ВК, Телеграм и др.)</p>
          </div>
        </button>

        <button
          type="button"
          class="flex items-center gap-4 rounded-btn bg-card-bg p-4 text-left transition hover:bg-hover-bg"
          @click="onCopy"
        >
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-active/20 text-active">
            <Icon name="file" w="w-5" h="w-5" />
          </div>
          <div>
            <p class="text-sm font-medium text-fg">Скопировать код</p>
            <p class="text-xs text-fg-muted">Для вставки в любой мессенджер</p>
          </div>
        </button>

        <div class="mt-4 flex items-center justify-between border-t border-hover-bg pt-4">
          <p class="text-xs text-fg-muted">Сохранить на устройство:</p>
          <div class="flex gap-3">
            <button class="text-xs text-active hover:underline" @click="onDownloadFile('m3u')">M3U</button>
            <button class="text-xs text-active hover:underline" @click="onDownloadFile('json')">JSON</button>
          </div>
        </div>
      </div>
    </ModalLayout>

    <ModalLayout v-if="isShowStringOpen" title="Скопируйте код" max-width="md" @close="isShowStringOpen = false">
      <p class="mb-2 text-xs text-fg-muted">Браузер запретил доступ к буферу. Скопируйте текст вручную:</p>
      <textarea
        :value="encodedString ?? ''"
        readonly
        class="h-40 w-full resize-none rounded-btn bg-card-bg px-3 py-2 font-mono text-xs text-fg"
      />
      <template #footer>
        <Button variant="primary" @click="copyFromModal">Скопировать</Button>
        <Button variant="ghost" @click="isShowStringOpen = false">Закрыть</Button>
      </template>
    </ModalLayout>
  </div>
</template>
