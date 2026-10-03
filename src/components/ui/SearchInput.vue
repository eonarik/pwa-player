<!-- src/components/ui/SearchInput.vue -->
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import IconX from '@/components/icons/IconX.vue'

const props = withDefaults(
  defineProps<{
    /** Всегда развёрнуто, без схлопывания (inline, не overlay) */
    alwaysOpen?: boolean
  }>(),
  { alwaysOpen: false },
)

const modelValue = defineModel<string>({ default: '' })

const isOpen = ref(props.alwaysOpen)
const inputRef = ref<HTMLInputElement | null>(null)

async function open() {
  isOpen.value = true
  await nextTick()
  inputRef.value?.focus()
}

function close() {
  if (props.alwaysOpen) return
  if (!modelValue.value) {
    isOpen.value = false
  }
}

function clear() {
  modelValue.value = ''
  inputRef.value?.focus()
}

function onSearchClose() {
  clear()
  close()
}

onMounted(async () => {
  if (props.alwaysOpen) {
    await nextTick()
    inputRef.value?.focus()
  }
})
</script>

<template>
  <!-- Режим alwaysOpen: поле в потоке, не схлопывается -->
  <div v-if="alwaysOpen" class="flex w-full items-center rounded-btn bg-card-bg px-2">
    <IconSearch class="h-4 w-4 shrink-0 text-fg-muted" />

    <input ref="inputRef" v-model="modelValue" type="text" placeholder="Поиск…"
      class="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
      @keydown.esc="clear" />

    <button v-if="modelValue" type="button" class="shrink-0 rounded-btn p-0.5 text-fg-subtle transition hover:text-fg"
      aria-label="Очистить" @mousedown.prevent="clear">
      <IconX class="h-3.5 w-3.5" />
    </button>
  </div>

  <!-- Режим overlay: иконка на месте, поле absolute -->
  <div v-else class="relative">
    <button type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-card-bg text-fg-muted transition hover:bg-hover-bg hover:text-fg"
      aria-label="Поиск" @click="isOpen ? close() : open()">
      <IconSearch class="h-4 w-4" />
    </button>

    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 -translate-x-1"
      enter-to-class="opacity-100 translate-x-0" leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-x-0" leave-to-class="opacity-0 -translate-x-1">
      <div v-if="isOpen"
        class="absolute left-9 top-0 z-30 flex w-56 items-center rounded-btn bg-bg-elevated px-2 shadow-lg">
        <input ref="inputRef" v-model="modelValue" type="text" placeholder="Поиск…"
          class="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
          @blur="close" @keydown.esc="onSearchClose()" />

        <button v-if="modelValue" type="button"
          class="shrink-0 rounded-btn p-0.5 text-fg-subtle transition hover:text-fg" aria-label="Очистить"
          @mousedown.prevent="clear">
          <IconX class="h-3.5 w-3.5" />
        </button>
      </div>
    </Transition>
  </div>
</template>
