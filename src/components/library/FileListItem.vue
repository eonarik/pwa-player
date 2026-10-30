<!-- src/components/library/FileListItem.vue -->

<script setup lang="ts">
import ListRow from '@/components/ui/ListRow.vue';
import Icon from '@/components/ui/Icon.vue';
import type { TextFileRef } from '@/plugins/types';

defineProps<{
  file: TextFileRef;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
}>();
</script>

<template>
  <ListRow @click="emit('open')">
    <template #leading>
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-card-bg text-fg-muted">
        <Icon name="file" w="w-5" h="h-5" />
      </div>
    </template>

    <template #title>
      <p class="truncate text-sm font-medium">{{ file.name }}</p>
    </template>

    <template #subtitle>
      <p class="truncate text-xs text-fg-muted">Текстовый файл</p>
    </template>
  </ListRow>
</template>
