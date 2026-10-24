<!-- src/components/ui/ModalHost.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { modalService } from '@/services/ui/ModalService'
import Input from '@/components/ui/Input.vue'
import Button from '@/components/ui/Button.vue'

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
    if (options.value?.type !== 'custom') {
      await nextTick()
      inputRef.value?.focus()
    }
  },
)

function onConfirm() {
  const opts = options.value
  if (!opts) return

  if (opts.type === 'input') {
    modalService.confirm(inputValue.value)
  } else if (opts.type === 'confirm') {
    modalService.confirm(true)
  }
}

function onCancel() {
  modalService.cancel()
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    if (options.value?.disableBackdropClose) return
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
    <div v-if="isOpen && options" class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70 px-4"
      @click="onBackdropClick" @keydown="onKeydown">

      <component :is="options.component" v-if="options.type === 'custom' && options.component" v-bind="options.props" />

      <form v-else class="w-full max-w-sm bg-bg-elevated p-5 shadow-xl rounded-card" @submit.prevent="onConfirm">
        <div class="mb-1 flex items-start justify-between gap-4">
          <h2 class="text-lg font-medium text-fg">
            {{ options.title }}
          </h2>
        </div>

        <p v-if="options.message" class="mb-4 text-sm text-fg-muted">
          {{ options.message }}
        </p>

        <Input v-if="options.type === 'input'" ref="inputRef" v-model="inputValue"
          :type="options.inputType === 'password' ? 'password' : 'text'"
          :placeholder="options.inputPlaceholder ?? ''" />

        <div class="mt-4 flex items-center justify-end gap-2">
          <Button v-if="options.cancelLabel !== undefined || options.type !== 'confirm'" variant="ghost"
            @click="onCancel">
            {{ options.cancelLabel ?? 'Отмена' }}
          </Button>

          <Button type="submit" variant="primary">
            {{ options.confirmLabel ?? 'OK' }}
          </Button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
