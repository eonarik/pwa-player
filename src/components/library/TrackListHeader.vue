<!-- src/components/library/TrackListHeader.vue -->

<script setup lang="ts">
import type { PluginCollectionAction, CollectionActionProgress } from '@/plugins/types';
import Icon from '@/components/atoms/Icon.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    visibleCollectionActions: PluginCollectionAction[];
    actionProgress: Record<string, CollectionActionProgress | null>;
  }>(),
  {
    subtitle: undefined,
  },
);

const emit = defineEmits<{
  (e: 'run-action', action: PluginCollectionAction): void;
}>();

function actionLabel(action: PluginCollectionAction): string {
  const progress = props.actionProgress[action.id];
  if (progress) {
    const foundPart = typeof progress.found === 'number' ? ` · найдено ${progress.found}` : '';
    return `${action.label}: ${progress.done}/${progress.total}${foundPart}`;
  }
  return action.label;
}

function isActionBusy(action: PluginCollectionAction): boolean {
  return Boolean(props.actionProgress[action.id]);
}
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-lg font-medium text-fg">{{ title }}</h1>
        <p v-if="subtitle" class="text-xs text-fg-muted">{{ subtitle }}</p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          v-for="action in visibleCollectionActions"
          :key="action.id"
          type="button"
          class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-60"
          :title="action.tooltip ?? action.label"
          :disabled="isActionBusy(action)"
          @click="emit('run-action', action)"
        >
          <Icon v-if="action.icon && !isActionBusy(action)" :name="action.icon" w="w-3.5" h="h-3.5" />
          <Icon v-else-if="isActionBusy(action)" name="spinner" w="w-3.5" h="h-3.5" class="animate-spin" />
          {{ actionLabel(action) }}
        </button>

        <slot name="header-actions" />
      </div>
    </div>
  </div>
</template>
