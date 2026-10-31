<!-- src/components/library/TrackList.vue -->

<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { useVirtualList } from '@/composables/useVirtualList';
import { useItemHeight } from '@/composables/useItemHeight';
import TrackListItem from './TrackListItem.vue';
import TrackActions from './TrackActions.vue';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

const props = defineProps<{
  tracks: Track[];
}>();

const emit = defineEmits<{
  (e: 'select', index: number): void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying, currentIndex } = storeToRefs(player);

const containerRef = ref<HTMLElement | null>(null);
const measureRef = ref<HTMLElement | null>(null);

const measuredHeight = useItemHeight(measureRef);

// Дедупликация на входе
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

const { totalHeight, visibleItems, offsetY } = useVirtualList({
  items: uniqueTracks,
  itemHeight: measuredHeight,
  overscan: 5,
  containerRef,
});

function getCurrentIndex(): number {
  const id = currentTrack.value?.id;
  if (!id) return -1;
  return uniqueTracks.value.findIndex((t) => t.id === id);
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      if (parent.scrollHeight > parent.clientHeight) {
        return parent;
      }
    }
    parent = parent.parentElement;
  }
  return null;
}

async function scrollToCurrent() {
  const idx = getCurrentIndex();
  if (idx < 0) return;

  await nextTick();

  if (!measuredHeight.value) {
    requestAnimationFrame(() => void scrollToCurrent());
    return;
  }

  requestAnimationFrame(() => {
    if (!containerRef.value) return;

    const scrollParent = findScrollParent(containerRef.value);
    if (!scrollParent) return;

    const itemHeight = measuredHeight.value;
    const parentHeight = scrollParent.clientHeight;
    const targetScrollTop = idx * itemHeight - parentHeight / 2 + itemHeight / 2;

    scrollParent.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    });
  });
}

watch(currentIndex, () => {
  scrollToCurrent();
});

onMounted(() => {
  scrollToCurrent();
});

watch(() => uniqueTracks.value.length, scrollToCurrent);

function isCurrent(track: Track): boolean {
  return currentTrack.value?.id === track.id;
}
</script>

<template>
  <div v-if="uniqueTracks.length === 0" class="p-8 text-center text-sm text-zinc-500">В этой папке нет треков</div>

  <div v-else ref="containerRef" class="min-h-[400px] h-full overflow-y-auto">
    <!-- Скрытый эталон для измерения высоты.
         Передаем фейковый трек и кастомный testIdPrefix, чтобы не мешать тестам -->
    <div ref="measureRef" class="pointer-events-none invisible absolute left-0 top-0 w-full" aria-hidden="true">
      <TrackListItem
        v-if="uniqueTracks[0]"
        :track="{ ...uniqueTracks[0], id: 'measure-item' as TrackId }"
        :index="0"
        :is-current="false"
        :is-playing="false"
        test-id-prefix="measure"
        @select="() => {}"
      />
    </div>

    <div class="relative" :style="{ height: `${totalHeight}px` }">
      <div class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${offsetY}px)` }">
        <TrackListItem
          v-for="{ item: track, index } in visibleItems"
          :key="track.id"
          :track="track"
          :index="index"
          :data-track-index="index"
          :is-current="isCurrent(track)"
          :is-playing="isPlaying"
          @select="(i: number) => emit('select', i)"
        >
          <template #actions>
            <TrackActions :track="track" />
          </template>
        </TrackListItem>
      </div>
    </div>
  </div>
</template>
