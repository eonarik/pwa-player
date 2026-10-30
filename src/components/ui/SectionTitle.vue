<!-- src/components/ui/SectionTitle.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string;
    paddingX?: 'none' | 'px-4';
    paddingBottom?: 'none' | 'pb-2';
    clickable?: boolean;
  }>(),
  {
    paddingX: 'px-4',
    paddingBottom: 'pb-2',
    clickable: false,
  },
);

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <div
    class="flex items-center justify-between gap-2"
    :class="[paddingX === 'px-4' ? 'px-4' : '', paddingBottom === 'pb-2' ? 'pb-2' : '']"
  >
    <component
      :is="clickable ? 'button' : 'p'"
      :type="clickable ? 'button' : undefined"
      class="text-[10px] font-medium uppercase tracking-wider text-fg-subtle"
      :class="clickable ? 'cursor-pointer select-none transition hover:text-fg-muted' : ''"
      @click="clickable ? emit('click') : undefined"
    >
      <slot>{{ text }}</slot>
    </component>
    <slot name="trailing" />
  </div>
</template>
