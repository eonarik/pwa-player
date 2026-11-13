<!-- src/components/ui/LinkButton.vue -->

<script setup lang="ts">
defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="text-xs text-active transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    @click.stop="emit('click', $event)"
  >
    <slot />
  </button>
</template>
