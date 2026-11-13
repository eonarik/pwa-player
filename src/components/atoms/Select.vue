<!-- src/components/ui/Select.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    options: Array<{ value: string; label: string }>;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    @change="onChange"
    class="rounded-btn bg-bg-elevated px-2 py-1 text-sm text-fg focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
  >
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>
