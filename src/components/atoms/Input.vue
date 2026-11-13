<!-- src/components/ui/Input.vue -->

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(
  defineProps<{
    modelValue: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    autofocus?: boolean;
  }>(),
  {
    type: 'text',
    disabled: false,
    autofocus: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const inputElement = ref<HTMLInputElement | null>(null);

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}

defineExpose({
  focus() {
    inputElement.value?.focus();
  },
});
</script>

<template>
  <input
    ref="inputElement"
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autofocus"
    @input="onInput"
    class="w-full rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle transition focus:bg-hover-bg focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
  />
</template>
