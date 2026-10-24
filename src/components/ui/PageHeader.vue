<!-- src/components/ui/PageHeader.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    maxWidth?: 'sm' | 'md' | 'lg'
  }>(),
  { maxWidth: 'md' },
)
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
    <div class="mx-auto flex w-full items-center justify-between gap-3" :class="{
      'max-w-2xl': maxWidth === 'sm',
      'max-w-3xl': maxWidth === 'md',
      'max-w-5xl': maxWidth === 'lg',
    }">
      <div class="min-w-0">
        <h1 class="truncate text-lg font-medium text-fg">{{ title }}</h1>
        <p v-if="subtitle" class="text-xs text-fg-muted">{{ subtitle }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <slot />
      </div>
    </div>
  </div>
</template>
