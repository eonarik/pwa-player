<!-- src/plugins/radio/RadioSavedList.vue -->

<script setup lang="ts">
import Button from '@/components/ui/Button.vue';
import SectionTitle from '@/components/ui/SectionTitle.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ListContainer from '@/components/ui/ListContainer.vue';
import Icon from '@/components/ui/Icon.vue';
import type { SavedStation } from './index';

const props = defineProps<{
  stations: SavedStation[];
  currentTrackTitle: string | null;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  (e: 'play', station: SavedStation): void;
  (e: 'remove', station: SavedStation): void;
  (e: 'add-by-url'): void;
}>();

function isCurrent(station: SavedStation): boolean {
  return props.currentTrackTitle === station.name;
}

function isStationPlaying(station: SavedStation): boolean {
  return isCurrent(station) && props.isPlaying;
}

function onRemove(station: SavedStation, e: Event): void {
  e.stopPropagation();
  emit('remove', station);
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl py-2 pt-4">
      <div class="flex items-center justify-between px-4 pb-2">
        <SectionTitle text="Мои станции" padding-x="none" padding-bottom="none" />
        <Button variant="secondary" size="sm" @click="emit('add-by-url')">
          <Icon name="link" w="w-3.5" h="h-3.5" />
          По URL
        </Button>
      </div>

      <EmptyState v-if="stations.length === 0" title="Вы пока не добавили ни одной станции">
        <template #icon>
          <Icon name="radio" w="w-10" h="h-10" />
        </template>
      </EmptyState>

      <ListContainer v-else max-width="lg">
        <div
          v-for="station in stations"
          :key="station.id"
          class="group flex items-center gap-3 rounded-btn px-3 py-2 transition hover:bg-hover-bg cursor-pointer"
          :class="isCurrent(station) ? 'bg-active/10' : ''"
          @click="emit('play', station)"
          data-testid="saved-station-row"
        >
          <div
            class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg"
          >
            <img
              v-if="station.favicon"
              :src="station.favicon"
              class="h-full w-full object-cover"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            <Icon v-else name="radio" w="w-5" h="h-5" class="text-fg-muted" />

            <div
              class="absolute inset-0 flex items-center justify-center bg-bg/50 opacity-0 transition group-hover:opacity-100"
            >
              <Icon name="play" w="w-5" h="h-5" class="text-fg translate-x-[1px]" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium" :class="isCurrent(station) ? 'text-active' : 'text-fg'">
              {{ station.name }}
            </p>
          </div>

          <div v-if="isStationPlaying(station)" class="flex shrink-0 items-center gap-1">
            <span class="h-3 w-0.5 animate-pulse bg-active" />
            <span class="h-4 w-0.5 animate-pulse bg-active [animation-delay:150ms]" />
            <span class="h-2 w-0.5 animate-pulse bg-active [animation-delay:300ms]" />
          </div>

          <button
            v-else
            type="button"
            class="rounded-btn p-1.5 text-fg-subtle opacity-100 transition hover:bg-hover-bg hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
            aria-label="Удалить станцию"
            @click="onRemove(station, $event)"
          >
            <Icon name="x" w="w-4" h="h-4" />
          </button>
        </div>
      </ListContainer>
    </div>
  </div>
</template>
