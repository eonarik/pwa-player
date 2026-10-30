<!-- src/plugins/radio/RadioFilters.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import Icon from '@/components/ui/Icon.vue';
import Input from '@/components/ui/Input.vue';
import SectionTitle from '@/components/ui/SectionTitle.vue';
import type { RadioSortOrder, RadioTag } from './RadioService';

export type RadioCountryEntry = {
  name: string;
  code: string;
  stationCount: number;
};

const props = defineProps<{
  countries: RadioCountryEntry[];
  tags: RadioTag[];
  countriesError: boolean;
  tagsError: boolean;
  topOrder: RadioSortOrder;
  topCountry: string;
  topTags: string[];
}>();

const emit = defineEmits<{
  (e: 'update:topOrder', value: RadioSortOrder): void;
  (e: 'update:topCountry', value: string): void;
  (e: 'update:topTags', value: string[]): void;
  (e: 'retry-countries'): void;
  (e: 'retry-tags'): void;
}>();

const ORDER_LABELS: Record<RadioSortOrder, string> = {
  clickCount: 'Топ чарт',
  votes: 'По голосам',
  clickTrend: 'В тренде',
  bitrate: 'По качеству',
  random: 'Случайные',
  name: 'По алфавиту',
};

const countryFilter = ref('');
const tagFilter = ref('');

const filteredCountries = computed(() => {
  const q = countryFilter.value.trim().toLowerCase();
  if (!q) return props.countries;
  return props.countries.filter((c) => c.name.toLowerCase().includes(q));
});

const filteredTags = computed(() => {
  const q = tagFilter.value.trim().toLowerCase();
  if (!q) return props.tags;
  return props.tags.filter((t) => t.name.toLowerCase().includes(q));
});

const showCounts = computed(() => !props.topCountry && props.topTags.length === 0);

function setOrder(value: RadioSortOrder, close: () => void): void {
  emit('update:topOrder', value);
  close();
}

function setCountry(code: string): void {
  emit('update:topCountry', code);
}

function toggleTag(name: string): void {
  const next = props.topTags.includes(name) ? props.topTags.filter((t) => t !== name) : [...props.topTags, name];
  emit('update:topTags', next);
}

function isTagSelected(name: string): boolean {
  return props.topTags.includes(name);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Сортировка -->
    <div class="max-w-xs">
      <SectionTitle text="Сортировка" padding-x="none" />
      <DropdownMenu :width="160" align="left">
        <template #trigger="{ toggle, setTriggerRef }">
          <button
            :ref="setTriggerRef"
            type="button"
            class="flex w-full items-center justify-between rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
            @click.stop="toggle"
          >
            {{ ORDER_LABELS[topOrder] }}
            <Icon name="chevron-down" w="w-3" h="h-3" />
          </button>
        </template>
        <template #default="{ close }">
          <button
            v-for="(label, key) in ORDER_LABELS"
            :key="key"
            type="button"
            class="block w-full px-3 py-2 text-left text-xs transition hover:bg-hover-bg"
            :class="topOrder === key ? 'text-active font-medium' : 'text-fg'"
            @click="setOrder(key as RadioSortOrder, close)"
          >
            {{ label }}
          </button>
        </template>
      </DropdownMenu>
    </div>

    <!-- Страна и теги -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Страна -->
      <div>
        <SectionTitle text="Страна" padding-x="none" />
        <div v-if="countriesError" class="flex flex-col items-start gap-2 bg-card-bg p-2 rounded">
          <span class="text-xs text-red-400">Ошибка загрузки</span>
          <button type="button" class="text-xs text-active hover:underline" @click="emit('retry-countries')">
            Повторить
          </button>
        </div>
        <template v-else>
          <Input v-model="countryFilter" placeholder="Поиск страны..." class="mb-2" />
          <div class="flex max-h-32 flex-col gap-1 overflow-y-auto pr-1">
            <button
              type="button"
              class="text-left text-xs px-2 py-1 rounded transition"
              :class="topCountry === '' ? 'bg-active/20 text-active font-medium' : 'text-fg hover:bg-hover-bg'"
              @click="setCountry('')"
            >
              Все страны
            </button>
            <button
              v-for="c in filteredCountries"
              :key="c.code"
              type="button"
              class="flex items-center justify-between gap-2 text-left text-xs px-2 py-1 rounded transition"
              :class="topCountry === c.code ? 'bg-active/20 text-active font-medium' : 'text-fg hover:bg-hover-bg'"
              @click="setCountry(c.code)"
            >
              <span class="truncate">{{ c.name }}</span>
              <span v-if="showCounts" class="shrink-0 text-[10px] tabular-nums text-fg-subtle">
                {{ c.stationCount }}
              </span>
            </button>
          </div>
        </template>
      </div>

      <!-- Теги -->
      <div>
        <SectionTitle text="Теги" padding-x="none" />
        <div v-if="tagsError" class="flex flex-col items-start gap-2 bg-card-bg p-2 rounded">
          <span class="text-xs text-red-400">Ошибка загрузки</span>
          <button type="button" class="text-xs text-active hover:underline" @click="emit('retry-tags')">
            Повторить
          </button>
        </div>
        <template v-else>
          <Input v-model="tagFilter" placeholder="Поиск тега..." class="mb-2" />
          <div class="flex max-h-32 flex-wrap gap-1 overflow-y-auto pr-1">
            <button
              type="button"
              class="text-left text-[10px] px-2 py-1 rounded border border-hover-bg transition"
              :class="
                topTags.length === 0
                  ? 'bg-active/20 border-active/20 text-active font-medium'
                  : 'text-fg-muted hover:bg-hover-bg'
              "
              @click="emit('update:topTags', [])"
            >
              Все
            </button>
            <button
              v-for="t in filteredTags"
              :key="t.name"
              type="button"
              class="text-left text-[10px] px-2 py-1 rounded border border-hover-bg transition"
              :class="
                isTagSelected(t.name)
                  ? 'bg-active/20 border-active/20 text-active font-medium'
                  : 'text-fg-muted hover:bg-hover-bg'
              "
              @click="toggleTag(t.name)"
            >
              {{ t.name }}
              <span v-if="showCounts" class="ml-0.5 tabular-nums opacity-60">
                {{ t.stationCount }}
              </span>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
