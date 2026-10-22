<!-- src/components/ui/AddRemoveButton.vue -->
<script setup lang="ts">
import IconPlus from '@/components/icons/IconPlus.vue'
import IconX from '@/components/icons/IconX.vue'

withDefaults(
  defineProps<{
    added: boolean
    iconClass?: string
    disabled?: boolean
  }>(),
  {
    iconClass: 'h-4 w-4',
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove'): void
}>()
</script>

<template>
  <button v-if="added" type="button"
    class="rounded-btn p-1.5 text-fg-subtle transition hover:bg-hover-bg hover:text-red-400 disabled:opacity-50"
    aria-label="Удалить из сохранённых" v-tooltip="'Удалить из сохранённых'" :disabled="disabled"
    @click.stop="emit('remove')">
    <IconX :class="iconClass" />
  </button>
  <button v-else type="button" class="rounded-btn p-1.5 text-active transition hover:bg-hover-bg disabled:opacity-50"
    aria-label="Добавить в сохранённые" v-tooltip="'Добавить в сохранённые'" :disabled="disabled"
    @click.stop="emit('add')">
    <IconPlus :class="iconClass" />
  </button>
</template>
