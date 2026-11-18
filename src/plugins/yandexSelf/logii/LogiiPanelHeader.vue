<!-- src/plugins/yandexSelf/logii/LogiiPanelHeader.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import IconButton from '@/components/atoms/IconButton.vue';
import Toggle from '@/components/atoms/Toggle.vue';

const props = defineProps<{
  pageIndex: number;
  authorName: string | null;
  folderName: string | null;
  logiiFileName: string | null;
  isRefreshing: boolean;
  canGoToParent: boolean;
  isEditMode?: boolean;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'go-to-parent'): void;
  (e: 'go-prev'): void;
  (e: 'update:isEditMode', value: boolean): void;
}>();

const breadcrumb = computed(() => {
  const parts: string[] = [];
  if (props.pageIndex === 0) return 'Авторы';

  if (props.authorName) parts.push(props.authorName);

  if (props.pageIndex === 2) {
    if (props.folderName) parts.push(props.folderName);
    else if (props.logiiFileName) parts.push(props.logiiFileName);
  }
  return parts.join(' / ') || '...';
});

function onBackClick() {
  // На мобилке: если мы не на первом экране, листаем назад. Если на первом — выходим в парент.
  // На десктопе: экранов нет, всегда выходим в парент (на уровень выше по файловой системе).
  if (props.isMobile && props.pageIndex > 0) {
    emit('go-prev');
  } else {
    emit('go-to-parent');
  }
}
</script>

<template>
  <div class="flex items-center gap-1 px-2 py-2 md:px-4 md:gap-2 shrink-0 border-b border-hover-bg bg-bg">
    <IconButton
      icon="arrow-left"
      variant="ghost"
      size="sm"
      label="Назад"
      data-testid="logii-go-to-parent"
      @click="onBackClick"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg">{{ breadcrumb }}</p>
    </div>

    <div class="flex items-center gap-1 md:gap-2">
      <Toggle
        :model-value="isEditMode ?? false"
        class="hidden md:inline-flex"
        data-testid="logii-edit-mode-toggle"
        @update:model-value="emit('update:isEditMode', $event)"
      />

      <IconButton
        icon="refresh"
        variant="ghost"
        size="sm"
        :icon-class="isRefreshing ? 'animate-spin' : ''"
        data-testid="logii-refresh"
        @click="emit('refresh')"
      />

      <slot name="header-actions" />
    </div>
  </div>
</template>
