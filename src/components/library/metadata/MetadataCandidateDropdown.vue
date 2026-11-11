<!-- src/components/library/metadata/MetadataCandidateDropdown.vue -->

<script setup lang="ts">
import type { Ref } from 'vue';
import type { MetadataCandidate } from '@/types/metadata';
import CoverImage from '@/components/ui/CoverImage.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { FloatingDropdownStyle } from './useFloatingDropdown';
import { candidateAlbumLabel, candidateSourceLabel, selectedCandidateLabel } from './candidateLabels';

defineProps<{
  candidates: MetadataCandidate[];
  isLoading: boolean;
  selectedIndex: number | null;
  isOpen: boolean;
  position: FloatingDropdownStyle;
  triggerRef: Ref<HTMLElement | null>;
  dropdownRef: Ref<HTMLElement | null>;
}>();

const emit = defineEmits<{
  toggle: [];
  select: [index: number];
}>();
</script>

<template>
  <div v-if="isLoading" class="flex flex-col gap-1">
    <label class="text-xs text-fg-muted">Найденные варианты</label>
    <Spinner size="sm" text="Поиск вариантов в интернете…" />
  </div>

  <div v-else-if="candidates.length > 0" class="relative flex flex-col gap-1">
    <label class="text-xs text-fg-muted">Найденные варианты</label>
    <button
      :ref="triggerRef"
      type="button"
      data-testid="metadata-candidates-trigger"
      class="flex w-full items-center justify-between rounded-btn bg-card-bg px-3 py-2 text-sm text-fg transition hover:bg-hover-bg"
      @click="emit('toggle')"
    >
      <span class="truncate">{{ selectedCandidateLabel(candidates, selectedIndex) }}</span>
      <Icon
        name="chevron-down"
        w="w-4"
        h="h-4"
        class="ml-2 shrink-0 text-fg-muted transition"
        :class="isOpen ? 'rotate-180' : ''"
      />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        :ref="dropdownRef"
        class="fixed z-[300] max-h-60 overflow-y-auto rounded-btn border border-hover-bg bg-bg-elevated shadow-lg"
        :style="position"
      >
        <button
          v-for="(c, i) in candidates"
          :key="i"
          type="button"
          data-testid="metadata-candidate-option"
          class="flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition hover:bg-hover-bg"
          :class="selectedIndex === i ? 'bg-active/10' : ''"
          @click="emit('select', i)"
        >
          <div class="h-10 w-10 shrink-0 overflow-hidden rounded-btn bg-card-bg">
            <CoverImage :src="c.coverUrl" :alt="c.title" fallback-icon-class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <span
              class="block truncate"
              :class="selectedIndex === i ? 'text-active font-medium' : 'text-fg'"
            >
              {{ c.artist }} — {{ c.title }}
            </span>
            <span class="block truncate text-xs text-fg-muted">{{ candidateAlbumLabel(c) }}</span>
            <span class="block truncate text-[10px] text-fg-subtle">{{ candidateSourceLabel(c) }}</span>
          </div>
        </button>
      </div>
    </Teleport>
  </div>
</template>
