<!-- src/plugins/radio/AddStationModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { toastService } from '@/services/ui/ToastService'
import IconX from '@/components/icons/IconX.vue'
import type { SavedStation } from './index'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'add', station: SavedStation): void
}>()

const url = ref('')
const name = ref('')
const isSubmitting = ref(false)

async function submit() {
  const cleanUrl = url.value.trim()
  if (!cleanUrl) return

  let hostname = ''
  try {
    const parsed = new URL(cleanUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      toastService.error('Ссылка должна начинаться с http:// или https://')
      return
    }
    hostname = parsed.hostname
  } catch {
    toastService.error('Некорректный URL')
    return
  }

  isSubmitting.value = true
  try {
    const finalName = name.value.trim() || hostname || 'Неизвестная станция'
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`

    emit('add', {
      id: cleanUrl,
      name: finalName,
      url: cleanUrl,
      favicon,
    })
    emit('close')
  } finally {
    isSubmitting.value = false
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4" @click="onBackdrop">
      <form class="flex w-full max-w-md flex-col bg-bg-elevated p-5 shadow-xl" @submit.prevent="submit">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-medium text-fg">Добавить станцию</h2>
          <button type="button" class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            aria-label="Закрыть" v-tooltip="'Закрыть'" @click="emit('close')">
            <IconX class="h-5 w-5" />
          </button>
        </div>

        <p class="mb-4 text-xs text-fg-muted">
          Введите прямую ссылку на поток (например, <span class="text-fg">https://stream.example.com/radio.m3u8</span>).
        </p>

        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-fg-muted">Ссылка на поток (URL) *</span>
            <input v-model="url" type="url" required placeholder="https://..."
              class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs text-fg-muted">Название станции</span>
            <input v-model="name" type="text" placeholder="Опционально (по умолчанию — домен)"
              class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />
          </label>
        </div>

        <div class="mt-6 flex items-center justify-end gap-2">
          <button type="button" class="rounded-btn px-4 py-2 text-sm text-fg-muted transition hover:text-fg"
            @click="emit('close')">
            Отмена
          </button>
          <button type="submit"
            class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="!url.trim() || isSubmitting">
            {{ isSubmitting ? 'Добавление…' : 'Добавить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
