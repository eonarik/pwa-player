<!-- src/components/ui/PlayingIndicator.vue -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 'bars' — полоски (для треков), 'eye' — магический глаз (для плееров) */
    variant?: 'bars' | 'eye'
  }>(),
  { variant: 'bars' },
)
</script>

<template>
  <div class="absolute inset-0 flex items-center justify-center bg-bg/50">
    <!-- Глаз (только для ретро-темы, иначе fallback на полоски) -->
    <div v-if="variant === 'eye'" class="radio-eye h-4 w-4 md:h-6 md:w-6" />

    <!-- Полоски (по умолчанию, или если глаз недоступен) -->
    <span v-else class="flex gap-0.5">
      <span class="h-3 w-0.5 animate-pulse bg-playing" />
      <span class="h-4 w-0.5 animate-pulse bg-playing [animation-delay:150ms]" />
      <span class="h-2 w-0.5 animate-pulse bg-playing [animation-delay:300ms]" />
    </span>
  </div>
</template>
