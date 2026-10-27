<!-- src/components/library/BatchAddToPlaylistButton.vue -->
<script setup lang="ts">
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PlaylistSubmenu from './PlaylistSubmenu.vue'
import type { Track } from '@/types/track'

defineProps<{
  tracks: Track[]
}>()
</script>

<template>
  <DropdownMenu v-if="tracks.length > 0" :width="256" align="right">
    <template #trigger="{ toggle, setTriggerRef }">
      <div :ref="setTriggerRef">
        <IconButton icon="plus" label="Добавить всё в плейлист" @click="toggle" />
      </div>
    </template>
    <template #default="{ close }">
      <PlaylistSubmenu :tracks="tracks" in-dropdown force-open @close="close" />
    </template>
  </DropdownMenu>
</template>
