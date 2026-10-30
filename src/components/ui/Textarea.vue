<!-- src/components/ui/Textarea.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    maxlength?: number;
    resize?: boolean;
  }>(),
  {
    rows: 4,
    disabled: false,
    resize: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :maxlength="maxlength"
    :class="resize ? 'resize-y' : 'resize-none'"
    spellcheck="false"
    class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition focus:bg-hover-bg focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    @input="onInput"
  />
</template>
