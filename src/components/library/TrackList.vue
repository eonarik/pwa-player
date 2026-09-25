<!-- src/components/library/TrackList.vue -->
<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useVirtualList } from '@/composables/useVirtualList'
import { useItemHeight } from '@/composables/useItemHeight'
import TrackListItem from './TrackListItem.vue'
import TrackActions from './TrackActions.vue'
import type { Track } from '@/types/track'

const props = defineProps<{
  tracks: Track[]
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const player = usePlayerStore()
const { currentTrack, isPlaying } = storeToRefs(player)

const containerRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)

const measuredHeight = useItemHeight(measureRef)

const { totalHeight, visibleItems, offsetY, scrollToIndex } = useVirtualList({
  items: toRef(props, 'tracks'),
  itemHeight: measuredHeight,
  overscan: 5,
  containerRef,
})

function getCurrentIndex(): number {
  const id = currentTrack.value?.id
  if (!id) return -1
  return props.tracks.findIndex((t) => t.id === id)
}

watch(currentTrack, () => {
  const idx = getCurrentIndex()
  if (idx >= 0) scrollToIndex(idx)
})

function isCurrent(track: Track): boolean {
  return currentTrack.value?.id === track.id
}
</script>

<template>
  <div v-if="tracks.length === 0" class="p-8 text-center text-sm text-zinc-500">
    В этой папке нет треков
  </div>

  <div v-else ref="containerRef" class="h-full overflow-y-auto">
    <!-- Скрытый эталон для измерения высоты.
         Без actions — чтобы кнопки не влияли на измерение. -->
    <div
      ref="measureRef"
      class="pointer-events-none invisible absolute left-0 top-0 w-full"
      aria-hidden="true"
    >
      <TrackListItem
        v-if="tracks[0]"
        :track="tracks[0]"
        :index="0"
        :is-current="false"
        :is-playing="false"
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
