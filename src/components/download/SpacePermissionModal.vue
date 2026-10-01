<!-- src/components/download/SpacePermissionModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { toastService } from '@/services/ui/ToastService'

const isRequesting = ref(false)
const isPicking = ref(false)

async function requestAccess() {
  if (isRequesting.value) return
  isRequesting.value = true

  try {
    const state = await downloadSpaceService.requestAccess()

    if (state === 'granted') {
      toastService.success('Доступ к папке скачивания восстановлен')
      return
    }

    toastService.error('Доступ отклонён. Выберите папку заново')
  } finally {
    isRequesting.value = false
  }
}

async function pickSpace() {
  if (isPicking.value) return
  isPicking.value = true

  try {
    const handle = await downloadSpaceService.pickSpace()
    if (handle) {
      toastService.success('Папка скачивания выбрана')
    } else {
      toastService.info('Папка не выбрана. Скачивание недоступно')
    }
  } finally {
    isPicking.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4">
      <div class="w-full max-w-md bg-bg-elevated p-6 shadow-xl">
        <h2 class="mb-2 text-lg font-medium text-fg">Нужен доступ к папке</h2>

        <p class="mb-5 text-sm text-fg-muted">
          Для скачивания треков нужен доступ к папке
          <span v-if="downloadSpaceService.spaceName.value" class="text-fg">
            «{{ downloadSpaceService.spaceName.value }}»
          </span>.
          Браузер требует подтвердить доступ после перезагрузки страницы.
        </p>

        <div class="flex flex-col gap-2">
          <button type="button"
            class="rounded-btn bg-accent px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="isRequesting || isPicking" @click="requestAccess">
            {{ isRequesting ? 'Запрос…' : 'Восстановить доступ' }}
          </button>

          <button type="button"
            class="rounded-btn bg-card-bg px-4 py-2.5 text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isRequesting || isPicking" @click="pickSpace">
            {{ isPicking ? 'Выбор…' : 'Выбрать другую папку' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
