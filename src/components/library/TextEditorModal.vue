<!-- src/components/library/TextEditorModal.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { yandexDiskService } from '@/plugins/yandexDisk/YandexDiskService'
import { yandexSelfService } from '@/plugins/yandexSelf/YandexSelfService'
import { toastService } from '@/services/ui/ToastService'
import IconButton from '@/components/ui/IconButton.vue'
import ModalLayout from '@/components/ui/ModalLayout.vue'
import Button from '@/components/ui/Button.vue'
import type { TextFileRef } from '@/types/library'
import { mergeText } from '@/utils/mergeText'

const props = defineProps<{
  file: TextFileRef
  pluginId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const getService = () => {
  if (props.pluginId === 'yandex-self') return yandexSelfService
  return yandexDiskService
}

const content = ref('')
const initialContent = ref('')
const initialModified = ref<string | null>(null)

const isLoading = ref(false)
const isSaving = ref(false)
const isSyncing = ref(false)
const isFullscreen = ref(false)

const isDirty = computed(() => content.value !== initialContent.value)
const isBusy = computed(() => isLoading.value || isSaving.value || isSyncing.value)

async function load() {
  isLoading.value = true
  try {
    const result = await getService().readTextFile(props.file.remotePath)
    if (!result) {
      toastService.error('Не удалось загрузить файл')
      emit('close')
      return
    }
    content.value = result.content
    initialContent.value = result.content
    initialModified.value = result.modified
  } finally {
    isLoading.value = false
  }
}

async function sync() {
  if (isBusy.value) return

  if (isDirty.value) {
    const confirmed = window.confirm(
      'У вас есть несохранённые изменения. Синхронизация загрузит версию с Диска и удалит ваши правки. Продолжить?',
    )
    if (!confirmed) return
  }

  isSyncing.value = true
  try {
    const result = await getService().readTextFile(props.file.remotePath)
    if (!result) {
      toastService.error('Не удалось загрузить файл')
      return
    }

    if (
      initialModified.value !== null &&
      result.modified !== null &&
      result.modified !== initialModified.value
    ) {
      toastService.info('Файл был изменён на Диске. Загружена актуальная версия.')
    }

    content.value = result.content
    initialContent.value = result.content
    initialModified.value = result.modified
  } finally {
    isSyncing.value = false
  }
}

async function save() {
  if (isBusy.value) return
  isSaving.value = true

  try {
    const currentRemote = await getService().readTextFile(props.file.remotePath)

    if (currentRemote && initialModified.value !== null && currentRemote.modified !== initialModified.value) {
      const merged = mergeText(initialContent.value, content.value, currentRemote.content)

      if (merged.hasConflicts) {
        content.value = merged.text
        toastService.error('Обнаружены конфликты. Разрешите их вручную и сохраните снова.')
        isSaving.value = false
        return
      }

      content.value = merged.text
      toastService.success('Изменения с Диска были автоматически объединены.')
    }

    const result = await getService().writeTextFile(props.file.remotePath, content.value)
    initialContent.value = content.value
    initialModified.value = result.modified
    toastService.success('Сохранено')
    emit('close')
  } catch (err) {
    toastService.error(err instanceof Error ? err.message : 'Не удалось сохранить')
  } finally {
    isSaving.value = false
  }
}

function cancel() {
  if (isDirty.value) {
    const confirmed = window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')
    if (!confirmed) return
  }
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      isFullscreen.value = false
    } else {
      cancel()
    }
  }
}

onMounted(() => {
  void load()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <ModalLayout :title="file.name" :max-width="'lg'" :disable-backdrop-close="true" :fullscreen="isFullscreen"
    @close="cancel">

    <!-- Кнопки в шапке: [фулскрин] [синк] [X (встроен в ModalLayout)] -->
    <template #header-actions>
      <IconButton :icon="isFullscreen ? 'minimize' : 'maximize'" :label="isFullscreen ? 'Свернуть' : 'Развернуть'"
        @click="isFullscreen = !isFullscreen" />
      <IconButton icon="refresh" :label="isSyncing ? 'Синхронизация…' : 'Синхронизировать'" :disabled="isBusy"
        :icon-class="isSyncing ? 'animate-spin' : ''" @click="sync" />
    </template>

    <!-- Контент -->
    <div v-if="isLoading" class="flex items-center justify-center text-sm text-fg-muted h-64">
      Загрузка…
    </div>
    <div v-else class="-m-5">
      <textarea v-model="content"
        class="block w-full resize-none bg-card-bg px-3 py-2 font-mono text-sm text-fg focus:bg-hover-bg focus:outline-none"
        :class="isFullscreen ? 'h-full min-h-screen rounded-none' : 'h-64 rounded-btn'" spellcheck="false" />
    </div>

    <!-- Футер (без кнопок синка и фулскрина) -->
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
