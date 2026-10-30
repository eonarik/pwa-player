<!-- src/views/folder/FolderHeader.vue -->

<script setup lang="ts">
import FolderBreadcrumbs from '@/components/library/FolderBreadcrumbs.vue';
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue';
import BatchAddToPlaylistButton from '@/components/library/BatchAddToPlaylistButton.vue';
import { pluralize } from '@/utils/pluralize';
import type { FolderRef } from '@/types/folder';
import type { Track } from '@/types/track';

defineProps<{
  currentFolder: FolderRef | null;
  subfoldersCount: number;
  tracksCount: number;
  filesCount: number;
  subtreeTracks: Track[];
  isScanning: boolean;
}>();
</script>

<template>
  <div class="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
    <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
      <FolderBreadcrumbs />

      <div class="flex items-center gap-2">
        <span v-if="currentFolder && !isScanning" class="shrink-0 text-xs text-fg-muted">
          <template v-if="subfoldersCount > 0">{{ pluralize(subfoldersCount, ['папка', 'папки', 'папок']) }}</template>
          <template v-if="subfoldersCount > 0 && tracksCount > 0"> · </template>
          <template v-if="tracksCount > 0">{{ pluralize(tracksCount, ['трек', 'трека', 'треков']) }}</template>
          <template v-if="filesCount > 0 && (subfoldersCount > 0 || tracksCount > 0)"> · </template>
          <template v-if="filesCount > 0">{{ pluralize(filesCount, ['файл', 'файла', 'файлов']) }}</template>
          <template v-if="subfoldersCount === 0 && tracksCount === 0 && filesCount === 0">пусто</template>
        </span>
        <span v-else-if="isScanning" class="shrink-0 text-xs text-fg-muted">Сканирование…</span>

        <BatchAddToPlaylistButton :tracks="subtreeTracks" />
        <BatchDownloadButton :tracks="subtreeTracks" />
      </div>
    </div>
  </div>
</template>
