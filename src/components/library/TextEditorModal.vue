<!-- src/components/library/TextEditorModal.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { yandexDiskService } from '@/plugins/yandexDisk/YandexDiskService'
import { toastService } from '@/services/ui/ToastService'
import IconX from '@/components/icons/IconX.vue'
import IconMaximize from '@/components/icons/IconMaximize.vue'
import IconMinimize from '@/components/icons/IconMinimize.vue'
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
const isFullscreen = ref(false)

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

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
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
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70"
      :class="isFullscreen ? 'p-0' : 'px-4'"
      @click.self="cancel"
    >
      <div
        class="flex flex-col bg-bg-elevated shadow-xl"
        :class="isFullscreen ? 'h-full w-full' : 'max-h-[80vh] w-full max-w-2xl'"
      >
        <!-- Шапка -->
        <div class="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <h2 class="truncate text-lg font-medium text-fg">{{ file.name }}</h2>

          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
              :aria-label="isFullscreen ? 'Свернуть' : 'Развернуть на весь экран'"
              :title="isFullscreen ? 'Свернуть' : 'Развернуть на весь экран'"
              @click="toggleFullscreen"
            >
              <IconMinimize v-if="isFullscreen" class="h-5 w-5" />
              <IconMaximize v-else class="h-5 w-5" />
            </button>

            <button
              type="button"
              class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
              aria-label="Закрыть"
              @click="cancel"
            >
              <IconX class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-hidden">
          <div
            v-if="isLoading"
            class="flex items-center justify-center text-sm text-fg-muted"
            :class="isFullscreen ? 'h-full' : 'h-64'"
          >
            Загрузка…
          </div>
          <textarea
            v-else
            v-model="content"
            class="w-full resize-none bg-card-bg px-3 py-2 font-mono text-sm text-fg focus:bg-hover-bg focus:outline-none"
            :class="isFullscreen ? 'h-full rounded-none' : 'h-64 rounded-btn'"
            spellcheck="false"
          />
        </div>

        <!-- Кнопки -->
        <div class="flex shrink-0 items-center justify-between gap-2 px-5 py-4">
          <button
            type="button"
            class="rounded-btn bg-card-bg px-3 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isBusy"
            @click="sync"
          >
            {{ isSyncing ? 'Синхронизация…' : 'Синхронизировать' }}
          </button>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-btn px-4 py-2 text-sm text-fg-muted transition hover:text-fg"
              @click="cancel"
            >
              Отмена
            </button>
            <button
              type="button"
              class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="isBusy"
              @click="save"
            >
              {{ isSaving ? 'Сохранение…' : 'Сохранить' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
