<!-- src/components/catalog/CatalogLayout.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import DropdownMenu from '@/components/molecules/DropdownMenu.vue';
import SectionTitle from '@/components/molecules/SectionTitle.vue';
import Icon from '@/components/atoms/Icon.vue';
import Button from '@/components/atoms/Button.vue';
import BottomSheet from '@/components/molecules/BottomSheet.vue';

withDefaults(
  defineProps<{
    title: string;
    backLabel: string;
    listTitle: string;
    searchQuery: string;
    showClear: boolean;
    isLoading: boolean;
    isLoadingMore?: boolean;
    isStale: boolean;
    error: string;
    isEmpty: boolean;
    emptyLabel?: string;
    limitOptions?: number[];
    currentLimit: number;
    hasMore: boolean;
    isMobile?: boolean;
    activeFiltersCount?: number;
  }>(),
  {
    emptyLabel: 'Ничего не найдено',
    limitOptions: () => [10, 15, 20, 30, 50],
    isLoadingMore: false,
    isMobile: false,
    activeFiltersCount: 0,
  },
);

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'clear'): void;
  (e: 'back'): void;
  (e: 'update:currentLimit', value: number): void;
  (e: 'load-more'): void;
}>();

const isFiltersOpen = ref(false);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка (Поиск и Фильтры) -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="flex items-center gap-2">
          <SearchInput
            :model-value="searchQuery"
            always-open
            placeholder="Поиск..."
            class="flex-1"
            @update:model-value="(v: string) => emit('update:searchQuery', v)"
          />
          <button
            v-if="showClear"
            type="button"
            class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg shrink-0"
            @click="emit('clear')"
          >
            <Icon name="x" w="w-4" h="h-4" />
          </button>

          <!-- Кнопка фильтров для мобилки -->
          <button
            v-if="isMobile"
            type="button"
            class="relative flex items-center gap-1.5 rounded-btn bg-card-bg px-3 py-2 text-xs font-medium text-fg transition hover:bg-hover-bg shrink-0"
            @click="isFiltersOpen = true"
          >
            <Icon name="filter" w="w-4" h="h-4" />
            <span>Фильтры</span>
            <span
              v-if="activeFiltersCount > 0"
              class="flex h-4 w-4 items-center justify-center rounded-full bg-active text-[9px] font-bold text-bg"
            >
              {{ activeFiltersCount }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Фильтры для десктопа -->
    <div v-if="!isMobile" class="shrink-0 bg-bg border-b border-hover-bg z-20">
      <div class="mx-auto w-full max-w-3xl py-3 max-h-[40vh] overflow-y-auto">
        <slot name="filters" />
      </div>
    </div>

    <!-- Фильтры для мобилки (BottomSheet) -->
    <BottomSheet :is-open="isFiltersOpen" title="Фильтры" @close="isFiltersOpen = false">
      <slot name="filters" />
      <div class="mt-4 pt-4 border-t border-hover-bg">
        <Button variant="primary" class="w-full" @click="isFiltersOpen = false">Применить</Button>
      </div>
    </BottomSheet>

    <!-- Основной контент -->
    <div class="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      <div class="mx-auto w-full max-w-3xl flex flex-col h-full">
        <div v-if="isStale" class="mx-4 mt-2 shrink-0 rounded-btn bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Сервер недоступен. Показаны сохранённые данные.
        </div>

        <!-- Заголовок списка и лимит (фиксированные) -->
        <div class="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
          <SectionTitle :text="listTitle" padding-x="none" padding-bottom="none" />
          <div class="flex items-center gap-2 shrink-0">
            <DropdownMenu :width="80" align="right">
              <template #trigger="{ toggle, setTriggerRef }">
                <button
                  :ref="setTriggerRef"
                  type="button"
                  class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-[10px] text-fg transition hover:bg-hover-bg"
                  @click.stop="toggle"
                >
                  {{ currentLimit }}
                  <Icon name="chevron-down" w="w-3" h="h-3" />
                </button>
              </template>
              <template #default="{ close }">
                <button
                  v-for="num in limitOptions"
                  :key="num"
                  type="button"
                  class="block w-full px-3 py-2 text-left text-xs transition hover:bg-hover-bg"
                  :class="currentLimit === num ? 'text-active font-medium' : 'text-fg'"
                  @click="
                    () => {
                      emit('update:currentLimit', num);
                      close();
                    }
                  "
                >
                  {{ num }}
                </button>
              </template>
            </DropdownMenu>
          </div>
        </div>

        <!-- Скроллируемый список -->
        <div class="flex-1 overflow-y-auto min-h-0 px-2">
          <div v-if="isLoading && !isLoadingMore" class="flex justify-center py-10">
            <Icon name="spinner" w="w-6" h="h-6" class="animate-spin text-fg-muted" />
          </div>
          <div v-else-if="error" class="flex flex-col items-center justify-center gap-3 py-10 text-sm text-red-400">
            {{ error }}
            <slot name="error-action" />
          </div>
          <div v-else-if="isEmpty" class="text-center py-10 text-sm text-fg-muted">
            {{ emptyLabel }}
          </div>
          <div v-else class="flex flex-col gap-0.5 pb-2">
            <slot name="list" />
          </div>
        </div>

        <!-- Кнопка "Показать еще" (фиксирована внизу) -->
        <div v-if="hasMore" class="shrink-0 p-4 border-t border-hover-bg bg-bg z-10 flex justify-center w-full">
          <Button variant="secondary" :disabled="isLoadingMore" class="w-full max-w-sm" @click="emit('load-more')">
            <Icon v-if="isLoadingMore" name="spinner" w="w-4" h="w-4" class="animate-spin" />
            <span>{{ isLoadingMore ? 'Загрузка...' : 'Показать еще' }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
