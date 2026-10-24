<!-- src/components/ui/Checkbox.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean
    label?: string
    description?: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label class="flex cursor-pointer items-start align-top gap-3 py-1 transition"
    :class="disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'">

    <!-- mt-[2px] нужен, чтобы квадратик визуально выровнялся по первой строке текста -->
    <input type="checkbox" :checked="modelValue" :disabled="disabled"
      class="mt-[2px] h-4 w-4 shrink-0 cursor-pointer accent-active" @change="onChange" />

    <div class="flex flex-col gap-0.5">
      <span v-if="label" class="text-sm text-fg leading-tight">{{ label }}</span>
      <span v-if="description" class="text-xs text-fg-muted leading-tight">{{ description }}</span>
    </div>
  </label>
</template>
