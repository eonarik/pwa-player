<!-- src/components/ui/FeedbackModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { toastService } from '@/services/ui/ToastService'
import ModalLayout from './ModalLayout.vue'
import Button from './Button.vue'
import FormField from './FormField.vue'
import Input from './Input.vue'
import Textarea from './Textarea.vue'

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
</script>

<template>
  <ModalLayout title="Обратная связь" max-width="md" @close="emit('close')">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <p class="text-xs text-fg-muted">
        Сообщение о проблеме, предложение или благодарность. Если авторизованы — приложим Яндекс ID.
      </p>

      <FormField label="Сообщение">
        <Textarea v-model="message" :maxlength="MAX_LENGTH" :rows="6" placeholder="Ваше сообщение…" resize />
        <p class="text-right text-[10px] tabular-nums text-fg-subtle mt-1">
          {{ message.length }} / {{ MAX_LENGTH }}
        </p>
      </FormField>

      <FormField label="Email для ответа (необязательно)">
        <Input v-model="email" type="email" placeholder="your@email.com" />
      </FormField>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="emit('close')">Отмена</Button>
        <Button variant="primary" :disabled="isSending || !message.trim()" @click="submit">
          {{ isSending ? 'Отправка…' : 'Отправить' }}
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
