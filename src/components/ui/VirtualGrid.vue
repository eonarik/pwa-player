<!-- src/components/ui/VirtualGrid.vue -->

<script setup lang="ts" generic="T">
import { computed, ref, watch } from 'vue';
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { useVirtualizer } from '@tanstack/vue-virtual';
import type { VirtualGridMode, VirtualGridSection } from './VirtualGrid.types';

const props = withDefaults(
  defineProps<{
    sections: VirtualGridSection<T>[];
    mode?: VirtualGridMode;
    forcedColumns?: number;
    minColumnWidth?: number;
    aspectRatio?: number;
    listRowHeight?: number;
    headerHeight?: number;
    gap?: number;
    sectionGap?: number;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  }>(),
  {
    mode: 'grid',
    minColumnWidth: 150,
    aspectRatio: 1.3,
    listRowHeight: 44,
    headerHeight: 32,
    gap: 16,
    sectionGap: 24,
    maxWidth: 'md',
  },
);

const emit = defineEmits<{
  (e: 'item-click', item: T): void;
  (e: 'item-play', item: T): void;
}>();

const isMobile = useMediaQuery('(max-width: 768px)');
const effectiveMode = computed<VirtualGridMode>(() => (isMobile.value ? 'list' : props.mode));

const containerRef = ref<HTMLElement | null>(null);
const { width } = useElementSize(containerRef);

const maxWidthClass = computed(() => {
  switch (props.maxWidth) {
    case 'sm':
      return 'max-w-2xl';
    case 'md':
      return 'max-w-3xl';
    case 'lg':
      return 'max-w-4xl';
    case 'xl':
      return 'max-w-5xl';
    case '2xl':
      return 'max-w-6xl';
    case 'full':
      return 'max-w-full';
    default:
      return 'max-w-3xl';
  }
});

const columnsCount = computed(() => {
  if (effectiveMode.value === 'list') return 1;
  if (props.forcedColumns) return props.forcedColumns;
  const available = width.value - 32;
  if (available <= 0) return 1;
  const cols = Math.floor(available / (props.minColumnWidth + props.gap));
  return Math.max(1, cols);
});

interface VirtualRow {
  type: 'header' | 'row';
  sectionIndex: number;
  rowIndex: number;
  title?: string;
  items?: T[]; // Заменили any на T
}

const flatRows = computed<VirtualRow[]>(() => {
  const result: VirtualRow[] = [];
  props.sections.forEach((section, sIdx) => {
    result.push({
      type: 'header',
      sectionIndex: sIdx,
      rowIndex: 0,
      title: section.title,
    });

    if (effectiveMode.value === 'list') {
      section.items.forEach((item, iIdx) => {
        result.push({
          type: 'row',
          sectionIndex: sIdx,
          rowIndex: iIdx,
          items: [item],
        });
      });
    } else {
      const cols = columnsCount.value;
      for (let i = 0; i < section.items.length; i += cols) {
        result.push({
          type: 'row',
          sectionIndex: sIdx,
          rowIndex: i / cols,
          items: section.items.slice(i, i + cols),
        });
      }
    }
  });
  return result;
});

const estimateSize = (index: number): number => {
  const row = flatRows.value[index];
  if (!row) return 50;

  if (row.type === 'header') return props.headerHeight + props.sectionGap;

  if (effectiveMode.value === 'list') {
    return props.listRowHeight + props.gap;
  }

  const containerW = width.value > 0 ? width.value : 800;
  const actualW = Math.min(containerW, 768) - 32;

  const colWidth = (actualW - props.gap * (columnsCount.value - 1)) / columnsCount.value;
  const imgHeight = colWidth * props.aspectRatio;
  return imgHeight + 48 + props.gap;
};

const virtualizer = useVirtualizer(
  computed(() => ({
    count: flatRows.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize,
    overscan: 5,
  })),
);

watch([width, () => effectiveMode.value], () => {
  virtualizer.value.measure();
});

const virtualItems = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

function scrollToLetter(letter: string) {
  const index = flatRows.value.findIndex(
    (r) => r.type === 'header' && r.title?.toUpperCase().startsWith(letter.toUpperCase()),
  );
  if (index !== -1) {
    virtualizer.value.scrollToIndex(index, { align: 'start', behavior: 'smooth' });
  }
}

defineExpose({ scrollToLetter });
</script>

<template>
  <div ref="containerRef" class="h-full overflow-y-auto relative">
    <div class="relative mx-auto w-full px-4 pb-10" :class="maxWidthClass" :style="{ height: `${totalSize}px` }">
      <div
        v-for="vRow in virtualItems"
        :key="vRow.index"
        class="absolute left-0 w-full px-4"
        :style="{
          transform: `translateY(${vRow.start}px)`,
        }"
        :data-index="vRow.index"
      >
        <template v-if="flatRows[vRow.index]">
          <div
            v-if="flatRows[vRow.index]!.type === 'header'"
            :id="`header-${flatRows[vRow.index]!.title}`"
            class="flex items-center font-medium text-fg-muted"
            :style="{ height: `${headerHeight}px` }"
          >
            {{ flatRows[vRow.index]!.title }}
          </div>

          <div
            v-else
            class="grid"
            :class="effectiveMode === 'list' ? 'grid-cols-1' : ''"
            :style="{
              gridTemplateColumns: effectiveMode === 'grid' ? `repeat(${columnsCount}, minmax(0, 1fr))` : undefined,
              gap: `${gap}px`,
            }"
          >
            <div
              v-for="(item, idx) in flatRows[vRow.index]!.items"
              :key="idx"
              @click="emit('item-click', item)"
              class="content-visibility-auto"
              :style="{ containIntrinsicSize: effectiveMode === 'grid' ? '0 250px' : '0 56px' }"
            >
              <slot name="item" :item="item" :mode="effectiveMode" />
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
