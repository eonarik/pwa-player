<!-- src/components/library/TextEditorModal.vue -->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import IconButton from '@/components/ui/IconButton.vue';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Button from '@/components/ui/Button.vue';
import type { TextFileRef, LibrarySource } from '@/plugins/types';
import { mergeText } from '@/utils/mergeText';

const props = defineProps<{
  file: TextFileRef;
  pluginId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const plugin = ref<LibrarySource | null>(null);
const content = ref('');
const initialContent = ref('');
const initialModified = ref<string | null>(null);

const isLoading = ref(false);
const isSaving = ref(false);
const isSyncing = ref(false);
const isFullscreen = ref(false);

const isDirty = computed(() => content.value !== initialContent.value);
const isBusy = computed(() => isLoading.value || isSaving.value || isSyncing.value);

async function resolvePlugin(): Promise<LibrarySource | null> {
  if (plugin.value) return plugin.value;
  try {
    const p = await loadPlugin(props.pluginId);
    if (!p.readTextFile || !p.writeTextFile) {
      toastService.error('Плагин не поддерживает редактирование текстовых файлов');
      return null;
    }
    plugin.value = p;
    return p;
  } catch (err) {
    console.error('[text-editor] failed to load plugin', err);
    toastService.error('Не удалось загрузить плагин');
    return null;
  }
}

async function load() {
  isLoading.value = true;
  try {
    const p = await resolvePlugin();
    if (!p?.readTextFile) {
      emit('close');
      return;
    }
    const context = createPluginContext(props.pluginId);
    const result = await p.readTextFile(context, props.file.remotePath);
    if (!result) {
      toastService.error('Не удалось загрузить файл');
      emit('close');
      return;
    }
    content.value = result.content;
    initialContent.value = result.content;
    initialModified.value = result.modified;
  } finally {
    isLoading.value = false;
  }
}

async function sync() {
  if (isBusy.value) return;

  if (isDirty.value) {
    const confirmed = window.confirm(
      'У вас есть несохранённые изменения. Синхронизация загрузит версию с Диска и удалит ваши правки. Продолжить?',
    );
    if (!confirmed) return;
  }

  isSyncing.value = true;
  try {
    const p = await resolvePlugin();
    if (!p?.readTextFile) return;
    const context = createPluginContext(props.pluginId);
    const result = await p.readTextFile(context, props.file.remotePath);
    if (!result) {
      toastService.error('Не удалось загрузить файл');
      return;
    }

    if (initialModified.value !== null && result.modified !== null && result.modified !== initialModified.value) {
      toastService.info('Файл был изменён на Диске. Загружена актуальная версия.');
    }

    content.value = result.content;
    initialContent.value = result.content;
    initialModified.value = result.modified;
  } finally {
    isSyncing.value = false;
  }
}

async function save() {
  if (isBusy.value) return;
  isSaving.value = true;

  try {
    const p = await resolvePlugin();
    if (!p?.readTextFile || !p.writeTextFile) {
      isSaving.value = false;
      return;
    }

    const context = createPluginContext(props.pluginId);
    const currentRemote = await p.readTextFile(context, props.file.remotePath);

    if (currentRemote && initialModified.value !== null && currentRemote.modified !== initialModified.value) {
      const merged = mergeText(initialContent.value, content.value, currentRemote.content);

      if (merged.hasConflicts) {
        content.value = merged.text;
        toastService.error('Обнаружены конфликты. Разрешите их вручную и сохраните снова.');
        isSaving.value = false;
        return;
      }

      content.value = merged.text;
      toastService.success('Изменения с Диска были автоматически объединены.');
    }

    const result = await p.writeTextFile(context, props.file.remotePath, content.value);
    initialContent.value = content.value;
    initialModified.value = result.modified;
    toastService.success('Сохранено');
    emit('close');
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : 'Не удалось сохранить');
  } finally {
    isSaving.value = false;
  }
}

function cancel() {
  if (isDirty.value) {
    const confirmed = window.confirm('Есть несохранённые изменения. Закрыть без сохранения?');
    if (!confirmed) return;
  }
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFullscreen.value) isFullscreen.value = false;
    else cancel();
  }
}

onMounted(() => {
  void load();
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <ModalLayout
    :title="file.name"
    :max-width="'lg'"
    :disable-backdrop-close="true"
    :fullscreen="isFullscreen"
    @close="cancel"
  >
    <template #header-actions>
      <IconButton
        :icon="isFullscreen ? 'minimize' : 'maximize'"
        :label="isFullscreen ? 'Свернуть' : 'Развернуть'"
        @click="isFullscreen = !isFullscreen"
      />
      <IconButton
        icon="refresh"
        :label="isSyncing ? 'Синхронизация…' : 'Синхронизировать'"
        :disabled="isBusy"
        :icon-class="isSyncing ? 'animate-spin' : ''"
        @click="sync"
      />
    </template>

    <div v-if="isLoading" class="flex items-center justify-center text-sm text-fg-muted h-64">Загрузка…</div>
    <div v-else class="-m-5">
      <textarea
        v-model="content"
        class="block w-full resize-none bg-card-bg px-3 py-2 font-mono text-sm text-fg focus:bg-hover-bg focus:outline-none"
        :class="isFullscreen ? 'h-full min-h-screen rounded-none' : 'h-64 rounded-btn'"
        spellcheck="false"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="isBusy" @click="save">
          {{ isSaving ? 'Сохранение…' : 'Сохранить' }}
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
