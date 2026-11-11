<!-- src/components/library/MetadataCandidatesButton.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import IconButton from '@/components/ui/IconButton.vue';
import MetadataCandidatesModal from './MetadataCandidatesModal.vue';
import RemoteMetadataModal from './RemoteMetadataModal.vue';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

const props = defineProps<{
  tracks: Track[];
}>();

const library = useLibraryStore();
const isDuplicatesOpen = ref(false);
const isRemoteOpen = ref(false);

/**
 * Количество групп дубликатов (BFS-компонентов) среди входных треков.
 * Совпадает с логикой groups в MetadataCandidatesModal.
 */
const duplicatesGroupCount = computed(() => {
  const idSet = new Set(props.tracks.map((t) => t.id));
  const visited = new Set<TrackId>();
  let groups = 0;

  for (const t of props.tracks) {
    if (visited.has(t.id)) continue;

    const track = library.getTrack(t.id);
    if (!track || !track.duplicateTrackIds || track.duplicateTrackIds.length === 0) continue;

    // BFS: обходим связный компонент дубликатов (только внутри tracks)
    const queue: Track[] = [track];
    const component: Track[] = [];
    visited.add(track.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const dupId of current.duplicateTrackIds) {
        if (visited.has(dupId) || !idSet.has(dupId)) continue;
        const dup = library.getTrack(dupId);
        if (!dup) continue;
        visited.add(dupId);
        queue.push(dup);
      }
    }

    if (component.length >= 2) {
      groups++;
    }
  }

  return groups;
});

const remoteCount = computed(() => {
  let c = 0;
  for (const t of props.tracks) {
    const track = library.getTrack(t.id);
    if (track?.metadataCandidates && track.metadataCandidates.length > 0) {
      c++;
    }
  }
  return c;
});
</script>

<template>
  <div v-if="duplicatesGroupCount > 0 || remoteCount > 0" class="relative">
    <div class="flex items-center gap-1">
      <IconButton
        v-if="duplicatesGroupCount > 0"
        icon="warning"
        label="Похожие треки"
        @click="isDuplicatesOpen = true"
      />
      <IconButton
        v-if="remoteCount > 0"
        icon="warning"
        label="Внешние метаданные"
        @click="isRemoteOpen = true"
      />

      <span
        v-if="duplicatesGroupCount + remoteCount > 0"
        class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-bg"
      >
        {{ duplicatesGroupCount + remoteCount }}
      </span>
    </div>

    <MetadataCandidatesModal
      v-if="isDuplicatesOpen"
      :track-ids="tracks.map((t) => t.id)"
      @close="isDuplicatesOpen = false"
    />
    <RemoteMetadataModal
      v-if="isRemoteOpen"
      :track-ids="tracks.map((t) => t.id)"
      @close="isRemoteOpen = false"
    />
  </div>
</template>

