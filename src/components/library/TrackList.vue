<!-- src/components/library/TrackList.vue -->

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { useVirtualizer } from '@tanstack/vue-virtual';
import TrackListItem from './TrackListItem.vue';
import TrackActions from './TrackActions.vue';
import type { Track } from '@/types/track';

const props = defineProps<{
  tracks: Track[];
}>();

const emit = defineEmits<{
  (e: 'select', index: number): void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying, currentIndex } = storeToRefs(player);

const containerRef = ref<HTMLElement | null>(null);
const scrollElement = ref<HTMLElement | null>(null);
const scrollMargin = ref(0);

const uniqueTracks = computed<Track[]>(() => {
  const seen = new Set<string>();
  const result: Track[] = [];
  for (const track of props.tracks) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    result.push(track);
  }
  return result;
});

// Находим родителя, который скроллится (overflow-y-auto)
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function updateMeasurements() {
  if (!containerRef.value) return;

  const scrollParent = findScrollParent(containerRef.value);
  scrollElement.value = scrollParent;

  if (scrollParent) {
    // Вычисляем отступ от верха скролл-контейнера до нашего списка
    const containerRect = containerRef.value.getBoundingClientRect();
    const scrollRect = scrollParent.getBoundingClientRect();
    // Добавляем scrollTop родителя, чтобы получить абсолютную позицию внутри контейнера
    scrollMargin.value = containerRect.top - scrollRect.top + scrollParent.scrollTop;
  }
}

const virtualizer = useVirtualizer(
  computed(() => ({
    count: uniqueTracks.value.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => 62, // Примерная высота
    overscan: 5,
    scrollMargin: scrollMargin.value, // Отступ от верха контейнера
  })),
);

const virtualItems = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

// Скролл к текущему
function getCurrentIndex(): number {
  const id = currentTrack.value?.id;
  if (!id) return -1;
  return uniqueTracks.value.findIndex((t) => t.id === id);
}

async function scrollToCurrent() {
  const idx = getCurrentIndex();
  if (idx < 0) return;

  await nextTick();
  updateMeasurements();
  virtualizer.value.scrollToIndex(idx, { align: 'center', behavior: 'smooth' });
}

watch(currentIndex, () => {
  scrollToCurrent();
});

onMounted(() => {
  updateMeasurements();
  scrollToCurrent();

  // Если размер окна меняется (или контейнера), пересчитываем
  window.addEventListener('resize', updateMeasurements);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateMeasurements);
});

watch(
  () => uniqueTracks.value.length,
  () => {
    updateMeasurements();
    virtualizer.value.measure();
  },
);

function isCurrent(track: Track): boolean {
  return currentTrack.value?.id === track.id;
}
</script>

<template>
  <div v-if="uniqueTracks.length === 0" class="p-8 text-center text-sm text-zinc-500">В этой папке нет треков</div>

  <!-- Рендерим контейнер. Если виртуализатор еще не инициализирован (scrollElement = null),
       рендерим пустоту (чтобы не было скачков). -->
  <div v-else ref="containerRef" class="relative w-full" :style="{ height: scrollElement ? `${totalSize}px` : 'auto' }">
    <div
      v-for="vItem in virtualItems"
      :key="String(vItem.key)"
      class="absolute left-0 top-0 w-full"
      :style="{
        transform: `translateY(${vItem.start - scrollMargin}px)`,
      }"
      :data-index="vItem.index"
    >
      <TrackListItem
        v-if="uniqueTracks[vItem.index]"
        :track="uniqueTracks[vItem.index]!"
        :index="vItem.index"
        :is-current="isCurrent(uniqueTracks[vItem.index]!)"
        :is-playing="isPlaying"
        @select="(i: number) => emit('select', i)"
      >
        <template #actions>
          <TrackActions :track="uniqueTracks[vItem.index]!" />
        </template>
      </TrackListItem>
    </div>
  </div>
</template>
