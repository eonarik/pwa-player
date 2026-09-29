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
    <div v-if="isOpen && options" class="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4"
      @click="onBackdropClick" @keydown="onKeydown">
      <form class="w-full max-w-sm rounded-modal bg-bg-elevated p-5 shadow-xl" @submit.prevent="onConfirm">
        <h2 class="mb-1 text-lg font-medium text-fg">
          {{ options.title }}
        </h2>

        <p v-if="options.message" class="mb-4 text-sm text-fg-muted">
          {{ options.message }}
        </p>

        <input v-if="options.type === 'input'" ref="inputRef" v-model="inputValue"
          :type="options.inputType === 'password' ? 'password' : 'text'" :placeholder="options.inputPlaceholder ?? ''"
          class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none" />

        <div class="mt-4 flex items-center justify-end gap-2">
          <button v-if="options.cancelLabel" type="button"
            class="rounded-btn px-3 py-2 text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
            @click="onCancel">
            {{ options.cancelLabel }}
          </button>

          <button type="submit"
            class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50">
            {{ options.confirmLabel ?? 'OK' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
