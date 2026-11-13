<!-- src/plugins/podcasts/components/PodcastFilters.vue -->

<script setup lang="ts">
import DropdownMenu from '@/components/molecules/DropdownMenu.vue';
import Icon from '@/components/atoms/Icon.vue';
import { PODCAST_COUNTRIES as COUNTRIES, PODCAST_GENRES as GENRES } from '../constants';

defineProps<{
  country: string;
  genre: string;
}>();

const emit = defineEmits<{
  (e: 'update:country', value: string): void;
  (e: 'update:genre', value: string): void;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- Страна -->
    <DropdownMenu :width="160" align="left">
      <template #trigger="{ toggle, setTriggerRef }">
        <button
          :ref="setTriggerRef"
          type="button"
          class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
          @click.stop="toggle"
          data-testid="podcast-filter-country"
        >
          {{ COUNTRIES.find((c) => c.code === country)?.label }}
          <Icon name="chevron-down" w="w-3" h="h-3" />
        </button>
      </template>
      <template #default="{ close }">
        <div class="max-h-[50vh] overflow-y-auto">
          <button
            v-for="c in COUNTRIES"
            :key="c.code"
            type="button"
            class="block w-full px-4 py-2 text-left text-xs transition hover:bg-hover-bg"
            :class="country === c.code ? 'text-active font-medium' : 'text-fg'"
            @click="
              emit('update:country', c.code);
              close();
            "
          >
            {{ c.label }}
          </button>
        </div>
      </template>
    </DropdownMenu>

    <!-- Жанр -->
    <DropdownMenu :width="200" align="left">
      <template #trigger="{ toggle, setTriggerRef }">
        <button
          :ref="setTriggerRef"
          type="button"
          class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
          @click.stop="toggle"
          data-testid="podcast-filter-genre"
        >
          {{ GENRES.find((g) => g.id === genre)?.label }}
          <Icon name="chevron-down" w="w-3" h="h-3" />
        </button>
      </template>
      <template #default="{ close }">
        <button
          v-for="g in GENRES"
          :key="g.id"
          type="button"
          class="block w-full px-4 py-2 text-left text-xs transition hover:bg-hover-bg"
          :class="genre === g.id ? 'text-active font-medium' : 'text-fg'"
          @click="
            emit('update:genre', g.id);
            close();
          "
        >
          {{ g.label }}
        </button>
      </template>
    </DropdownMenu>
  </div>
</template>
