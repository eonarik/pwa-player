<!-- src/components/ui/PlayingIndicator.vue -->

<template>
  <div class="playing-indicator absolute inset-0 flex items-center justify-center bg-bg/50">
    <span class="playing-indicator-inner flex gap-0.5">
      <span class="h-3 w-0.5 animate-pulse bg-playing" />
      <span class="h-4 w-0.5 animate-pulse bg-playing [animation-delay:150ms]" />
      <span class="h-2 w-0.5 animate-pulse bg-playing [animation-delay:300ms]" />
    </span>
  </div>
</template>
