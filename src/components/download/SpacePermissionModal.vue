<!-- src/components/download/SpacePermissionModal.vue -->

<script setup lang="ts">
import { ref } from 'vue';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { toastService } from '@/services/ui/ToastService';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import Button from '@/components/ui/Button.vue';

const isRequesting = ref(false);
const isPicking = ref(false);

async function requestAccess() {
  if (isRequesting.value) return;
  isRequesting.value = true;

  try {
    const state = await downloadSpaceService.requestAccess();

    if (state === 'granted') {
      toastService.success('Доступ к папке скачивания восстановлен');
      return;
    }

    toastService.error('Доступ отклонён. Выберите папку заново');
  } finally {
    isRequesting.value = false;
  }
}

async function pickSpace() {
  if (isPicking.value) return;
  isPicking.value = true;

  try {
    const handle = await downloadSpaceService.pickSpace();
    if (handle) {
      toastService.success('Папка скачивания выбрана');
    } else {
      toastService.info('Папка не выбрана. Скачивание недоступно');
    }
  } finally {
    isPicking.value = false;
  }
}
</script>

<template>
  <ModalLayout title="Нужен доступ к папке" max-width="sm" :disable-backdrop-close="true" @close="() => {}">
    <p class="mb-5 text-sm text-fg-muted">
      Для скачивания треков нужен доступ к папке
      <span v-if="downloadSpaceService.spaceName.value" class="text-fg">
        «{{ downloadSpaceService.spaceName.value }}» </span
      >. Браузер требует подтвердить доступ после перезагрузки страницы.
    </p>

    <div class="flex flex-col gap-2">
      <Button variant="primary" :disabled="isRequesting || isPicking" @click="requestAccess">
        {{ isRequesting ? 'Запрос…' : 'Восстановить доступ' }}
      </Button>

      <Button variant="secondary" :disabled="isRequesting || isPicking" @click="pickSpace">
        {{ isPicking ? 'Выбор…' : 'Выбрать другую папку' }}
      </Button>
    </div>
  </ModalLayout>
</template>
