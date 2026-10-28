<!-- src/components/library/AlternatesButton.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import IconButton from '@/components/ui/IconButton.vue'
import AlternatesModal from './AlternatesModal.vue'
import type { Track } from '@/types/track'

const props = defineProps<{
  tracks: Track[]
}>()

const library = useLibraryStore()
const isModalOpen = ref(false)

const count = computed(() => {
  let c = 0
  for (const t of props.tracks) {
    const track = library.getTrack(t.id)
    if (track?.alternateSources && track.alternateSources.length > 0) {
      c++
    }
  }
  return c
})
</script>

<template>
  <div v-if="count > 0" class="relative">
    <IconButton icon="warning" label="Проблемные совпадения" @click="isModalOpen = true" />
    <span
      class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-bg">
      {{ count }}
    </span>

    <AlternatesModal v-if="isModalOpen" :track-ids="tracks.map(t => t.id)" @close="isModalOpen = false" />
  </div>
</template>
