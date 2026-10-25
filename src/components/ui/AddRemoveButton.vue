<!-- src/components/ui/AddRemoveButton.vue -->
<script setup lang="ts">
import IconButton from './IconButton.vue'

withDefaults(
  defineProps<{
    added: boolean
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'remove'): void
}>()
</script>

<template>
  <IconButton v-if="added" icon="x" variant="ghost" :disabled="disabled" label="Удалить из сохранённых"
    class="text-red-400 hover:!text-red-400" @click.stop="emit('remove')" />
  <IconButton v-else icon="plus" variant="ghost" :disabled="disabled" label="Добавить в сохранённые"
    class="text-active hover:!text-active" @click.stop="emit('add')" />
</template>
