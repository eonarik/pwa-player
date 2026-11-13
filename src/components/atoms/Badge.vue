<!-- src/components/ui/Badge.vue -->

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'active' | 'live' | 'danger';
  }>(),
  { variant: 'default' },
);
</script>

<template>
  <span
    class="rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
    :class="{
      'bg-hover-bg text-fg-muted': variant === 'default',
      'bg-active/20 text-active': variant === 'active',
      'bg-active/20 text-active font-bold uppercase tracking-wider': variant === 'live',
      'bg-red-500/20 text-red-400': variant === 'danger',
    }"
  >
    <slot />
  </span>
</template>
