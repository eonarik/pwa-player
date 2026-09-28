<!-- src/components/ui/ModalHost.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { modalService } from '@/services/ui/ModalService'

const active = modalService.active

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const isOpen = computed(() => active.value !== null)
const options = computed(() => active.value?.options ?? null)

watch(
  () => active.value?.id,
  async (id) => {
    if (!id) return
    inputValue.value = ''
    await nextTick()
    inputRef.value?.focus()
  },
)

function onConfirm() {
  const opts = options.value
  if (!opts) return

  if (opts.type === 'input') {
    modalService.confirm(inputValue.value)
  } else if (opts.type === 'confirm') {
    modalService.confirm(true)
  } else {
    modalService.confirm(null)
  }
}

function onCancel() {
  modalService.cancel()
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    onCancel()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    onCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && options" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      @click="onBackdropClick" @keydown="onKeydown">
      <form class="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl"
        @submit.prevent="onConfirm">
        <h2 class="mb-1 text-lg font-medium text-zinc-100">
          {{ options.title }}
        </h2>

        <p v-if="options.message" class="mb-4 text-sm text-zinc-500">
          {{ options.message }}
        </p>

        <input v-if="options.type === 'input'" ref="inputRef" v-model="inputValue"
          :type="options.inputType === 'password' ? 'password' : 'text'" :placeholder="options.inputPlaceholder ?? ''"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500" />

        <div class="mt-4 flex items-center justify-end gap-2">
          <button v-if="options.cancelLabel" type="button"
            class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-200" @click="onCancel">
            {{ options.cancelLabel }}
          </button>

          <button type="submit"
            class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-emerald-400 disabled:opacity-50">
            {{ options.confirmLabel ?? 'OK' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
