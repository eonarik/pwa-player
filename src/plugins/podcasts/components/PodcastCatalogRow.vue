<!-- src/plugins/podcasts/components/PodcastCatalogRow.vue -->

<script setup lang="ts">
import AddRemoveButton from '@/components/ui/AddRemoveButton.vue';
import Icon from '@/components/atoms/Icon.vue';
import type { Podcast } from '../types';

defineProps<{
  podcast: Podcast;
  /** Трек этого подкаста стоит в плеере (независимо от того, играет или на паузе). */
  isCurrent: boolean;
  /** Трек этого подкаста сейчас воспроизводится. */
  isPlaying: boolean;
  isSubscribed: boolean;
  /** Лента этого подкаста грузится. */
  isLoadingSubscription: boolean;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'toggle-play'): void;
  (e: 'add'): void;
  (e: 'remove'): void;
}>();

const playLabel = (playing: boolean) => (playing ? 'Пауза' : 'Играть все эпизоды');
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-btn px-3 py-2 transition"
    :class="isCurrent ? 'bg-active/10' : 'hover:bg-hover-bg'"
    data-testid="podcast-row"
  >
    <button
      type="button"
      class="flex items-center gap-3 min-w-0 flex-1 text-left"
      data-testid="podcast-row-open"
      @click="emit('open')"
    >
      <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-card-bg">
        <img
          v-if="podcast.image"
          :src="podcast.image"
          class="h-full w-full object-cover"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <Icon v-else name="radio" w="w-5" h="h-5" class="text-fg-muted" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium" :class="isCurrent ? 'text-active' : 'text-fg'">
          {{ podcast.title }}
        </p>
        <p class="truncate text-xs text-fg-muted">{{ podcast.author }}</p>
      </div>
    </button>

    <div class="flex shrink-0 items-center gap-1">
      <span v-if="isLoadingSubscription" class="text-xs text-fg-muted px-2" data-testid="podcast-row-loading">
        Загрузка…
      </span>
      <template v-else>
        <button
          type="button"
          class="rounded-btn p-1.5 transition"
          :class="isPlaying ? 'text-active hover:bg-hover-bg' : 'text-fg-subtle hover:bg-hover-bg hover:text-fg'"
          :aria-label="playLabel(isPlaying)"
          v-tooltip="playLabel(isPlaying)"
          data-testid="podcast-row-play"
          @click="emit('toggle-play')"
        >
          <Icon :name="isPlaying ? 'pause' : 'play'" w="w-4" h="h-4" />
        </button>
        <AddRemoveButton :added="isSubscribed" @add="emit('add')" @remove="emit('remove')" />
      </template>
    </div>
  </div>
</template>
