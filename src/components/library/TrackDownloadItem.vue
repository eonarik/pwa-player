<!-- src/components/library/TrackDownloadItem.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/ui/Icon.vue';

const props = defineProps<{
  /** Трек есть в библиотеке — иначе иконка не показывается. */
  isKnown: boolean;
  /** Файл уже на устройстве. */
  isDownloaded: boolean;
  isDownloading: boolean;
  label: string;
}>();

const emit = defineEmits<{ (e: 'click'): void }>();

/** Свободный слот для скачивания: файл ещё не загружен и загрузка не идёт. */
const canStart = computed(() => props.isKnown && !props.isDownloaded && !props.isDownloading);
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition"
    :class="canStart ? 'text-fg hover:bg-hover-bg' : 'text-fg-muted hover:bg-hover-bg hover:text-red-400'"
    data-testid="track-action-download"
    @click="emit('click')"
  >
    <Icon v-if="canStart" name="download" w="w-4" h="h-4" />
    <Icon v-else-if="isDownloaded" name="cloud-check" w="w-4" h="h-4" />
    <Icon v-else-if="isDownloading" name="x" w="w-4" h="h-4" />
    <span class="truncate">{{ label }}</span>
  </button>
</template>
