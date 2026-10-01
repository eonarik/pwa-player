<!-- src/components/library/TextEditorModal.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { yandexDiskService } from '@/plugins/yandexDisk/YandexDiskService'
import { toastService } from '@/services/ui/ToastService'
import type { TextFileRef } from '@/types/library'

const props = defineProps<{
  file: TextFileRef
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const content = ref('')
const initialContent = ref('')
const initialModified = ref<string | null>(null)

const isLoading = ref(false)
const isSaving = ref(false)
const isSyncing = ref(false)

const isDirty = computed(() => content.value !== initialContent.value)
const isBusy = computed(() => isLoading.value || isSaving.value || isSyncing.value)

async function load() {
  isLoading.value = true
  try {
    const result = await yandexDiskService.readTextFile(props.file.remotePath)
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
  isSyncing.value = true
  try {
    const result = await yandexDiskService.readTextFile(props.file.remotePath)
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
    const result = await yandexDiskService.writeTextFile(props.file.remotePath, content.value)
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

onMounted(() => {
  void load()
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4" @click.self="cancel">
      <div class="flex max-h-[80vh] w-full max-w-2xl flex-col bg-bg-elevated shadow-xl">
        <!-- Шапка -->
        <div class="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <h2 class="truncate text-lg font-medium text-fg">{{ file.name }}</h2>
          <button type="button" class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            aria-label="Закрыть" @click="cancel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-hidden px-5 pb-4">
          <div v-if="isLoading" class="flex h-64 items-center justify-center text-sm text-fg-muted">
            Загрузка…
          </div>
          <textarea v-else v-model="content"
            class="h-64 w-full resize-none rounded-btn bg-card-bg px-3 py-2 font-mono text-sm text-fg focus:bg-hover-bg focus:outline-none"
            spellcheck="false" />
        </div>

        <!-- Кнопки -->
        <div class="flex shrink-0 items-center justify-between gap-2 px-5 py-4">
          <button type="button"
            class="rounded-btn bg-card-bg px-3 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isBusy" @click="sync">
            {{ isSyncing ? 'Синхронизация…' : 'Синхронизировать' }}
          </button>

          <div class="flex items-center gap-2">
            <button type="button" class="rounded-btn px-4 py-2 text-sm text-fg-muted transition hover:text-fg"
              @click="cancel">
              Отмена
            </button>
            <button type="button"
              class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="isBusy" @click="save">
              {{ isSaving ? 'Сохранение…' : 'Сохранить' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
