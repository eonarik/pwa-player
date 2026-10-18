<!-- src/components/ui/FeedbackModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { toastService } from '@/services/ui/ToastService'
import IconX from '@/components/icons/IconX.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const message = ref('')
const email = ref('')
const isSending = ref(false)

const MAX_LENGTH = 5000

async function submit() {
  if (isSending.value) return
  const text = message.value.trim()
  if (!text) return

  isSending.value = true
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        email: email.value.trim() || undefined,
      }),
    })

    if (res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      toastService.error(data.error ?? 'Слишком часто. Подождите минуту.')
      return
    }

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      toastService.error(data.error ?? 'Не удалось отправить')
      return
    }

    toastService.success('Сообщение отправлено')
    emit('close')
  } catch (err) {
    console.error('[feedback] send failed', err)
    toastService.error('Не удалось отправить')
  } finally {
    isSending.value = false
  }
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4" @click="onBackdrop"
      @keydown="onKeydown">
      <form class="flex w-full max-w-md flex-col bg-bg-elevated p-5 shadow-xl" @submit.prevent="submit">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-medium text-fg">Обратная связь</h2>
          <button type="button" class="rounded-btn p-1 text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            aria-label="Закрыть" v-tooltip="'Закрыть'" @click="emit('close')">
            <IconX class="h-5 w-5" />
          </button>
        </div>

        <p class="mb-3 text-xs text-fg-muted">
          Сообщение о проблеме, предложение или благодарность. Если авторизованы — приложим
          Яндекс ID.
        </p>

        <textarea v-model="message" :maxlength="MAX_LENGTH" rows="6" placeholder="Ваше сообщение…"
          class="mb-2 w-full resize-none rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          spellcheck="false" />

        <p class="mb-3 text-right text-[10px] tabular-nums text-fg-subtle">
          {{ message.length }} / {{ MAX_LENGTH }}
        </p>

        <input v-model="email" type="email" placeholder="Email для ответа (необязательно)"
          class="mb-4 w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />

        <div class="flex items-center justify-end gap-2">
          <button type="button" class="rounded-btn px-4 py-2 text-sm text-fg-muted transition hover:text-fg"
            @click="emit('close')">
            Отмена
          </button>
          <button type="submit"
            class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
            :disabled="isSending || !message.trim()">
            {{ isSending ? 'Отправка…' : 'Отправить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
