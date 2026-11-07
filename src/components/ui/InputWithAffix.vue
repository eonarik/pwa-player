<!-- src/components/ui/InputWithAffix.vue -->

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
    prefix?: string;
    suffix?: string;
    /** data-testid для `<input>` (прокидывается в нативный input, не в обёртку). */
    testId?: string;
  }>(),
  {
    type: 'text',
    disabled: false,
    autofocus: false,
    prefix: '',
    suffix: '',
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
  <div
    class="flex items-center rounded-btn bg-card-bg px-3 py-2 text-sm transition focus-within:bg-hover-bg"
    :class="disabled ? 'opacity-50 cursor-not-allowed' : ''"
  >
    <span v-if="prefix" class="shrink-0 select-none text-fg-disabled">{{ prefix }}</span>
    <input
      ref="inputElement"
      :id="id"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autofocus="autofocus"
      :data-testid="testId"
      class="min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-subtle focus:outline-none disabled:cursor-not-allowed"
      @input="onInput"
    />
    <span v-if="suffix" class="shrink-0 select-none text-fg-disabled">{{ suffix }}</span>
  </div>
</template>
