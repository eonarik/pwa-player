<!-- src/plugins/yandexSelf/logii/LogiiPanelHeader.vue -->

<script setup lang="ts">
import IconButton from '@/components/atoms/IconButton.vue';
import Toggle from '@/components/atoms/Toggle.vue';

export type LogiiTab = 'track' | 'gallery';

defineProps<{
  authorName: string | null;
  folderName: string | null;
  logiiFileName: string | null;
  activeTab: LogiiTab;
  isRefreshing: boolean;
  trackCount: number;
  chatCount: number;
  galleryCount: number;
  canGoToParent: boolean;
  /** Intro — не показываем табы. */
  isIntro?: boolean;
  /** Режим редактирования: показывает create/update/delete кнопки. */
  isEditMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LogiiTab): void;
  (e: 'refresh'): void;
  (e: 'go-to-parent'): void;
  (e: 'update:isEditMode', value: boolean): void;
}>();

const TABS: Array<{ id: LogiiTab; label: string }> = [
  { id: 'track', label: 'Трек' },
  { id: 'gallery', label: 'Галерея' },
];

function countFor(tab: LogiiTab, counts: { track: number; gallery: number }): number {
  return counts[tab];
}
</script>

<template>
  <div class="flex shrink-0 items-center gap-2 border-b border-hover-bg bg-bg px-4 py-2">
    <IconButton
      icon="arrow-left"
      variant="ghost"
      size="sm"
      label="К папкам"
      :disabled="!canGoToParent"
      data-testid="logii-go-to-parent"
      @click="emit('go-to-parent')"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg" data-testid="logii-panel-title">
        <template v-if="authorName && folderName">
          <span class="text-fg-muted">{{ authorName }}</span>
          <span class="text-fg-subtle"> / </span>
          <span>{{ folderName }}</span>
        </template>
        <template v-else-if="authorName && logiiFileName">
          <span class="text-fg-muted">{{ authorName }}</span>
          <span class="text-fg-subtle"> / </span>
          <span>{{ logiiFileName }}</span>
        </template>
        <template v-else-if="authorName">
          <span>{{ authorName }}</span>
        </template>
        <template v-else>Выберите трек</template>
      </p>
    </div>

    <div class="flex items-center gap-1">
      <Toggle
        :model-value="isEditMode ?? false"
        data-testid="logii-edit-mode-toggle"
        @update:model-value="emit('update:isEditMode', $event)"
      />
    </div>

    <IconButton
      icon="refresh"
      variant="ghost"
      size="sm"
      :label="isRefreshing ? 'Обновляем…' : 'Обновить с облака'"
      :icon-class="isRefreshing ? 'animate-spin' : ''"
      data-testid="logii-refresh"
      @click="emit('refresh')"
    />

    <slot name="header-actions" />

    <div v-if="!isIntro" class="flex shrink-0 gap-1">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        class="rounded-btn px-3 py-1.5 text-xs font-medium transition inline-flex items-center gap-1.5"
        :class="activeTab === tab.id ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'"
        :aria-label="tab.label"
        :data-testid="`logii-tab-${tab.id}`"
        @click="emit('update:activeTab', tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="countFor(tab.id, { track: trackCount, gallery: galleryCount }) > 0"
          class="rounded-full bg-hover-bg px-1.5 py-0.5 text-[10px] tabular-nums"
          :class="activeTab === tab.id ? 'bg-active/20 text-active' : 'text-fg-muted'"
        >
          {{ countFor(tab.id, { track: trackCount, gallery: galleryCount }) }}
        </span>
      </button>
    </div>
  </div>
</template>
