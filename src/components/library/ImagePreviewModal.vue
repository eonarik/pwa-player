<!-- src/components/library/ImagePreviewModal.vue -->

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import { modalService } from '@/services/ui/ModalService';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Spinner from '@/components/ui/Spinner.vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { TextFileRef } from '@/plugins/types';

const props = defineProps<{
  file: TextFileRef;
  pluginId: string;
}>();

const imageUrl = ref<string | null>(null);
const isLoading = ref(true);
const isFullscreen = ref(false);

async function loadImage() {
  try {
    const plugin = await loadPlugin(props.pluginId);
    if (!plugin.buildFileUrl) {
      toastService.error('Плагин не поддерживает просмотр файлов');
      modalService.cancel();
      return;
    }

    const context = createPluginContext(props.pluginId);
    const url = await plugin.buildFileUrl(context, props.file.remotePath);

    if (!url) {
      toastService.error('Не удалось получить ссылку на файл');
      modalService.cancel();
      return;
    }

    imageUrl.value = url;
  } catch (err) {
    console.error('[image-preview] failed to load', err);
    toastService.error('Ошибка загрузки изображения');
    modalService.cancel();
  } finally {
    isLoading.value = false;
  }
}

function close() {
  modalService.cancel();
}

onMounted(() => {
  void loadImage();
});
</script>

<template>
  <ModalLayout
    :title="file.name"
    max-width="lg"
    :disable-backdrop-close="false"
    :fullscreen="isFullscreen"
    @close="close"
  >
    <template #header-actions>
      <IconButton
        :icon="isFullscreen ? 'minimize' : 'maximize'"
        :label="isFullscreen ? 'Свернуть' : 'Развернуть'"
        @click="isFullscreen = !isFullscreen"
      />
    </template>

    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <Spinner size="lg" text="Загрузка изображения…" />
    </div>

    <div
      v-else-if="imageUrl"
      class="flex items-center justify-center bg-bg/50 rounded-btn overflow-hidden min-h-[300px]"
    >
      <img
        :src="imageUrl"
        :alt="file.name"
        class="max-h-[70vh] max-w-full object-contain transition-transform duration-300"
        :class="isFullscreen ? 'max-h-screen' : ''"
        @error="() => toastService.error('Не удалось отобразить картинку')"
      />
    </div>
  </ModalLayout>
</template>
