<!-- src/components/library/TrackMetadataMenu.vue -->

<script setup lang="ts">
defineProps<{
  /** Прямой эфир: метаданные не показываются вовсе. */
  isLive: boolean;
  /** Линейный контент (радио/подкаст): поиск и правка метаданных недоступны. */
  isLinear: boolean;
  isSearching: boolean;
  hasMetadataEdits: boolean;
  /** Стриминг: удалять метаданные нельзя. */
  isStreaming: boolean;
  candidateCount: number;
}>();

const emit = defineEmits<{
  (e: 'find'): void;
  (e: 'edit'): void;
  (e: 'remove'): void;
  (e: 'candidates'): void;
}>();
</script>

<template>
  <template v-if="!isLive && !isLinear">
    <button
      type="button"
      class="block w-full px-4 py-1.5 text-left text-sm text-fg transition hover:bg-hover-bg hover:text-fg-muted disabled:opacity-50"
      :disabled="isSearching"
      data-testid="track-action-find-metadata"
      @click="emit('find')"
    >
      <span v-if="isSearching">Поиск…</span>
      <span v-else>Найти в интернете<br /><span class="text-fg-subtle text-xs">сбросит ручные правки</span></span>
    </button>

    <template v-if="hasMetadataEdits">
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        data-testid="track-action-edit-metadata"
        @click="emit('edit')"
      >
        Редактировать метаданные
      </button>
      <button
        v-if="!isStreaming"
        type="button"
        class="block w-full px-4 py-1.5 text-left text-xs text-red-400 transition hover:bg-hover-bg"
        data-testid="track-action-remove-metadata"
        @click="emit('remove')"
      >
        Удалить метаданные
      </button>
    </template>

    <template v-else>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
        data-testid="track-action-edit-metadata"
        @click="emit('edit')"
      >
        Редактировать вручную
      </button>
    </template>
  </template>

  <button
    v-if="candidateCount > 0"
    type="button"
    class="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-amber-400 transition hover:bg-hover-bg"
    data-testid="track-action-candidates"
    @click="emit('candidates')"
  >
    <span>Альтернативные совпадения</span>
    <span class="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
      {{ candidateCount }}
    </span>
  </button>
</template>
