// src/composables/useCollectionView.ts

import { computed, shallowRef, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { compareStrings } from '@/utils/sort';
import type { VirtualGridSection } from '@/components/ui/VirtualGrid.types';

export interface VirtualGridExposed {
  scrollToLetter: (letter: string) => void;
}

export function useCollectionView<T>(options: {
  getGroupKey: (item: T) => string;
  sortItems?: (a: T, b: T) => number;
  storageKey: string;
}) {
  const viewMode = useStorage<'grid' | 'list'>(options.storageKey, 'grid');

  const rawItems = shallowRef<T[]>([]);
  const gridRef = ref<VirtualGridExposed | null>(null);

  function setItems(items: T[]) {
    rawItems.value = items;
  }

  const sections = computed<VirtualGridSection<T>[]>(() => {
    const map = new Map<string, T[]>();
    for (const item of rawItems.value) {
      const key = options.getGroupKey(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    const sortedKeys = Array.from(map.keys()).sort(compareStrings);

    return sortedKeys.map((key) => {
      let items = map.get(key)!;
      if (options.sortItems) {
        items = [...items].sort(options.sortItems);
      }
      return { title: key, items };
    });
  });

  const letters = computed(() => sections.value.map((s) => s.title));

  function onLetterSelect(letter: string) {
    gridRef.value?.scrollToLetter(letter);
  }

  return {
    viewMode,
    gridRef,
    setItems,
    sections,
    letters,
    onLetterSelect,
  };
}
