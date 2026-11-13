<!-- src/components/ui/Textarea.vue -->

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    maxlength?: number;
    resize?: boolean;
    /** Авто-высота по содержимому. */
    autoResize?: boolean;
    /** Мин. строк при autoResize (default 1). */
    minRows?: number;
    /** Макс. строк при autoResize (default 10), дальше — скролл. */
    maxRows?: number;
  }>(),
  {
    rows: 4,
    disabled: false,
    resize: false,
    autoResize: false,
    minRows: 1,
    maxRows: 10,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const el = ref<HTMLTextAreaElement | null>(null);

function autosize(): void {
  if (!props.autoResize || !el.value) return;
  const node = el.value;
  node.style.height = 'auto';
  const style = window.getComputedStyle(node);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const rows = Math.max(props.minRows, Math.min(props.maxRows, Math.ceil(node.scrollHeight / lineHeight) - 1));
  const height = rows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  node.style.height = `${height}px`;
  node.style.overflowY = rows >= props.maxRows ? 'auto' : 'hidden';
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
  autosize();
}

onMounted(() => {
  autosize();
});

watch(
  () => props.modelValue,
  () => {
    autosize();
  },
);

defineExpose({
  focus() {
    el.value?.focus();
  },
});
</script>

<template>
  <textarea
    ref="el"
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
