<!-- src/components/catalog/CatalogLayout.vue -->
<script setup lang="ts">
import SearchInput from '@/components/ui/SearchInput.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import SectionTitle from '@/components/ui/SectionTitle.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import IconChevronDown from '@/components/icons/IconChevronDown.vue'
import IconChevronLeft from '@/components/icons/IconChevronLeft.vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'

withDefaults(
  defineProps<{
    title: string
    backLabel: string
    listTitle: string
    searchQuery: string
    showClear: boolean
    isLoading: boolean
    isStale: boolean
    error: string
    isEmpty: boolean
    emptyLabel?: string
    limitOptions?: number[]
    currentLimit: number
    currentPage: number
    hasMore: boolean
    showPagination: boolean
  }>(),
  {
    emptyLabel: 'Ничего не найдено',
    limitOptions: () => [5, 10, 15, 20, 30],
    showPagination: true,
  },
)

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
  (e: 'clear'): void
  (e: 'back'): void
  (e: 'update:currentLimit', value: number): void
  (e: 'prev'): void
  (e: 'next'): void
}>()
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-hover-bg bg-bg z-30">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-medium text-fg">{{ title }}</h1>
          <button type="button"
            class="flex items-center gap-1 rounded-btn text-xs font-medium text-fg-muted transition hover:text-fg"
            @click="emit('back')">
            <IconArrowLeft class="h-4 w-4" />
            {{ backLabel }}
          </button>
        </div>

        <div class="flex items-center gap-2">
          <SearchInput :model-value="searchQuery" always-open placeholder="Поиск..."
            @update:model-value="(v: string) => emit('update:searchQuery', v)" />
          <button v-if="showClear" type="button"
            class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg"
            @click="emit('clear')">
            Сбросить
          </button>
        </div>
      </div>
    </div>

    <div class="shrink-0 bg-bg border-b border-hover-bg z-20">
      <div class="mx-auto w-full max-w-3xl py-3">
        <slot name="filters" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl py-2 flex flex-col h-full">
        <div v-if="isStale" class="mx-1 mb-2 rounded-btn bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Сервер недоступен. Показаны сохранённые данные.
        </div>

        <div class="flex items-center justify-between px-1 mb-2 shrink-0">
          <SectionTitle :text="listTitle" padding-x="none" padding-bottom="none" />
          <div class="flex items-center gap-2 shrink-0">
            <DropdownMenu :width="80" align="right">
              <template #trigger="{ toggle, setTriggerRef }">
                <button :ref="setTriggerRef" type="button"
                  class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-[10px] text-fg transition hover:bg-hover-bg"
                  @click.stop="toggle">
                  {{ currentLimit }}
                  <IconChevronDown class="h-3 w-3" />
                </button>
              </template>
              <template #default="{ close }">
                <button v-for="num in limitOptions" :key="num" type="button"
                  class="block w-full px-3 py-2 text-left text-xs transition hover:bg-hover-bg"
                  :class="currentLimit === num ? 'text-active font-medium' : 'text-fg'"
                  @click="() => { emit('update:currentLimit', num); close() }">
                  {{ num }}
                </button>
              </template>
            </DropdownMenu>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0 pr-1">
          <div v-if="isLoading" class="flex justify-center py-10">
            <IconSpinner class="h-6 w-6 animate-spin text-fg-muted" />
          </div>
          <div v-else-if="error" class="text-center py-10 text-sm text-red-400">
            {{ error }}
          </div>
          <div v-else-if="isEmpty" class="text-center py-10 text-sm text-fg-muted">
            {{ emptyLabel }}
          </div>
          <div v-else class="flex flex-col gap-0.5 pb-4">
            <slot name="list" />
          </div>
        </div>

        <div v-if="showPagination && !isLoading && !error && !isEmpty"
          class="shrink-0 border-t border-hover-bg pt-3 pb-2 flex items-center justify-between mt-auto">
          <button type="button"
            class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="currentPage === 1" @click="emit('prev')">
            <IconChevronLeft class="h-4 w-4" /> Назад
          </button>
          <span class="text-xs text-fg-muted">Страница {{ currentPage }}</span>
          <button type="button"
            class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasMore" @click="emit('next')">
            Вперед
            <IconChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
