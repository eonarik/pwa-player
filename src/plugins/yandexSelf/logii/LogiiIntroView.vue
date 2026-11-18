<!-- src/plugins/yandexSelf/logii/LogiiIntroView.vue -->

<script setup lang="ts">
import { computed } from 'vue';
import LogiiVibeBlock from './LogiiVibeBlock.vue';
import LogiiChat from './LogiiChat.vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';

const props = defineProps<{
  folder: LogiiTrackItem;
  data: LogiiData | null;
  isLoading: boolean;
  isSaving: boolean;
  isEditMode: boolean;
  onUpdateVibe: (text: string) => Promise<boolean>;
  onSendComment: (text: string) => Promise<void>;
  onUpdateComment: (index: number, text: string) => Promise<boolean>;
  onDeleteComment: (index: number) => Promise<boolean>;
}>();

const vibeTitle = computed(() => props.folder.logiiFileName ?? 'Vibe');
const comments = computed(() => props.data?.comments ?? []);
</script>

<template>
  <div class="flex flex-col gap-6">
    <LogiiVibeBlock
      :vibe="data?.vibe ?? ''"
      :title="vibeTitle"
      :is-loading="isLoading"
      :is-saving="isSaving"
      :is-edit-mode="isEditMode"
      :on-update-vibe="onUpdateVibe"
    />

    <LogiiChat
      :comments="comments"
      :is-saving="isSaving"
      :is-loading="isLoading"
      :is-edit-mode="isEditMode"
      :track-url-path="folder.urlPath"
      :on-update-comment="onUpdateComment"
      :on-delete-comment="onDeleteComment"
      @send="onSendComment"
    />
  </div>
</template>
