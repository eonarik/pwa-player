<!-- src/components/auth/LoginModal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { authService } from '@/services/auth/AuthService'

const props = defineProps<{
  /** Если true — нельзя закрыть, пароль обязателен */
  mandatory?: boolean
}>()

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'cancel'): void
}>()

const password = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

async function submit() {
  if (!password.value) return
  error.value = null
  isLoading.value = true

  try {
    const ok = await authService.login(password.value)
    if (ok) {
      emit('success')
      return
    }
    error.value = 'Неверный пароль'
    password.value = ''
  } finally {
    isLoading.value = false
  }
}

function cancel() {
  if (props.mandatory) return
  emit('cancel')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
    @click.self="cancel"
  >
    <form
      class="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl"
      @submit.prevent="submit"
    >
      <h2 class="mb-1 text-lg font-medium text-zinc-100">Введите пароль</h2>
      <p class="mb-4 text-sm text-zinc-500">
        {{ mandatory ? 'Без пароля доступ невозможен' : 'Доступ к приватным папкам' }}
      </p>

      <input
        v-model="password"
        type="password"
        placeholder="Пароль"
        autofocus
        class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500"
      />

      <p v-if="error" class="mt-2 text-xs text-red-400">{{ error }}</p>

      <div class="mt-4 flex items-center justify-end gap-2">
        <button
          v-if="!mandatory"
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
          @click="cancel"
        >
          Пропустить
        </button>
        <button
          type="submit"
          class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400 disabled:opacity-50"
          :disabled="!password || isLoading"
        >
          {{ isLoading ? 'Проверка…' : 'Войти' }}
        </button>
      </div>
    </form>
  </div>
</template>
