<!-- src/components/playlists/ImportPlaylistModal.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Button from '@/components/ui/Button.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { toastService } from '@/services/ui/ToastService';
import {
  parsePlaylistText,
  importPlaylist,
  type ParsedPlaylist,
  type ImportStats,
} from '@/services/playlists/ImportService';
import type { PlaylistId } from '@/types/ids';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'imported', payload: { playlistId: PlaylistId; stats: ImportStats }): void;
}>();

const mode = ref<'menu' | 'manual'>('menu');
const rawText = ref('');
const fileName = ref<string | null>(null);
const isImporting = ref(false);
const isParsing = ref(false);
const parsed = ref<ParsedPlaylist | null>(null);
const parseError = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

async function processText(text: string, name?: string) {
  if (!text.trim()) return;
  mode.value = 'manual';
  rawText.value = text;
  if (name) fileName.value = name;

  isParsing.value = true;
  try {
    const result = await parsePlaylistText(text, name?.replace(/\.[^.]+$/, '') || 'Импортированный плейлист');
    if (result) {
      parsed.value = result;
      parseError.value = '';
    } else {
      parsed.value = null;
      parseError.value = 'Не удалось распознать формат.';
    }
  } finally {
    isParsing.value = false;
  }
}

// 1. Вставить из буфера
async function pasteFromClipboard() {
  try {
    const text = await window.navigator.clipboard.readText();
    if (!text) {
      toastService.info('Буфер пуст');
      return;
    }
    await processText(text);
  } catch {
    toastService.error('Нет доступа к буферу. Вставьте вручную.');
    mode.value = 'manual';
  }
}

// 2. Выбрать файл
function triggerFilePicker() {
  fileInputRef.value?.click();
}

async function onFileSelected(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) await processText(await file.text(), file.name);
  target.value = '';
}

// 3. Вставить вручную
function openManual() {
  mode.value = 'manual';
  rawText.value = '';
  parsed.value = null;
  parseError.value = '';
}

async function doImport() {
  if (!parsed.value || isImporting.value) return;
  isImporting.value = true;
  try {
    const result = await importPlaylist(parsed.value);
    toastService.success(`Плейлист «${parsed.value.name}» создан`);
    emit('imported', result);
    emit('close');
  } catch {
    toastService.error('Ошибка импорта');
  } finally {
    isImporting.value = false;
  }
}

// Debounce-парсинг при ручном вводе
let parseTimer: ReturnType<typeof setTimeout> | null = null;

watch(rawText, (val) => {
  if (mode.value !== 'manual') return;
  if (parseTimer) clearTimeout(parseTimer);
  parseTimer = setTimeout(async () => {
    if (!val.trim()) {
      parsed.value = null;
      parseError.value = '';
      return;
    }
    isParsing.value = true;
    try {
      const res = await parsePlaylistText(val);
      parsed.value = res;
      parseError.value = res ? '' : 'Неизвестный формат';
    } finally {
      isParsing.value = false;
    }
  }, 400);
});
</script>

<template>
  <ModalLayout title="Импорт плейлиста" max-width="md" :disable-backdrop-close="isImporting" @close="emit('close')">
    <!-- ЭКРАН 1: Меню с кнопками -->
    <div v-if="mode === 'menu'" class="flex flex-col gap-3">
      <p class="text-sm text-fg-muted mb-2">Как вы хотите получить плейлист?</p>

      <button
        type="button"
        class="flex items-center gap-4 rounded-btn bg-card-bg p-4 text-left transition hover:bg-hover-bg"
        @click="pasteFromClipboard"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-active/20 text-active">
          <Icon name="file" w="w-5" h="w-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-fg">Вставить из буфера</p>
          <p class="text-xs text-fg-muted">Если друг прислал код в чат</p>
        </div>
      </button>

      <button
        type="button"
        class="flex items-center gap-4 rounded-btn bg-card-bg p-4 text-left transition hover:bg-hover-bg"
        @click="triggerFilePicker"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-active/20 text-active">
          <Icon name="folder" w="w-5" h="w-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-fg">Выбрать файл</p>
          <p class="text-xs text-fg-muted">Файлы .m3u, .json или .txt</p>
        </div>
      </button>

      <button
        type="button"
        class="flex items-center gap-4 rounded-btn bg-card-bg p-4 text-left transition hover:bg-hover-bg"
        @click="openManual"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-active/20 text-active">
          <Icon name="pencil" w="w-5" h="w-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-fg">Вставить вручную</p>
          <p class="text-xs text-fg-muted">Открыть текстовое поле</p>
        </div>
      </button>
    </div>

    <!-- ЭКРАН 2: Ручной ввод / Предпросмотр -->
    <div v-else class="flex flex-col gap-4">
      <button type="button" class="text-xs text-active hover:underline self-start" @click="mode = 'menu'">
        ← Назад к выбору
      </button>

      <textarea
        v-model="rawText"
        placeholder="Вставьте код CUEI1:, M3U или JSON сюда..."
        class="h-40 w-full resize-none rounded-btn bg-card-bg px-3 py-2 font-mono text-xs text-fg focus:bg-hover-bg focus:outline-none"
      />

      <div v-if="isParsing" class="text-sm text-fg-muted flex items-center gap-2">
        <Spinner size="sm" /> Распознавание...
      </div>
      <div v-else-if="parsed" class="rounded-btn bg-active/10 px-3 py-2 text-sm text-active">
        Распознан: <b>{{ parsed.name }}</b> ({{ parsed.tracks.length }} треков)
      </div>
      <div v-else-if="parseError" class="rounded-btn bg-red-500/10 px-3 py-2 text-sm text-red-400">
        {{ parseError }}
      </div>

      <div class="mt-2 flex justify-end gap-2">
        <Button variant="primary" :disabled="!parsed || isImporting" @click="doImport">
          {{ isImporting ? 'Импорт...' : 'Импортировать' }}
        </Button>
      </div>
    </div>

    <input ref="fileInputRef" type="file" accept=".m3u,.json,.txt" class="hidden" @change="onFileSelected" />
  </ModalLayout>
</template>
