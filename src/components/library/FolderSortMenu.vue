<!-- src/components/library/FolderSortMenu.vue -->
<script setup lang="ts">
import { sortService } from '@/services/sort/SortService'
import IconButton from '@/components/ui/IconButton.vue'
import { computed } from 'vue'

const iconName = computed(() => sortService.dir.value === 'asc' ? 'arrow-down' : 'arrow-up')
</script>

<template>
  <IconButton :icon="iconName" :label="sortService.dirLabel" @click="sortService.toggleDir()" />
</template>
