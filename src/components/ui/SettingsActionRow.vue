<!-- src/components/ui/SettingsActionRow.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    variant?: 'default' | 'danger';
    disabled?: boolean;
  }>(),
  { variant: 'default', disabled: false },
);

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex w-full items-center justify-between gap-4 bg-card-bg px-4 py-3 text-left transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
    @click="emit('click')"
  >
    <div class="min-w-0">
      <p class="text-sm" :class="variant === 'danger' ? 'text-red-400' : 'text-fg'">{{ title }}</p>
      <p v-if="description" class="text-xs" :class="variant === 'danger' ? 'text-red-400/70' : 'text-fg-muted'">
        {{ description }}
      </p>
    </div>
    <slot name="trailing" />
  </button>
</template>
