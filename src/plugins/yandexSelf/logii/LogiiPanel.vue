<!-- src/plugins/yandexSelf/logii/LogiiPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';
import LogiiPanelHeader, { type LogiiTab } from './LogiiPanelHeader.vue';
import LogiiTrackTab from './LogiiTrackTab.vue';
import LogiiChat from './LogiiChat.vue';
import LogiiGallery from './LogiiGallery.vue';

const props = defineProps<{
  authorName: string | null;
  folder: LogiiTrackItem | null;
  data: LogiiData | null;
  isLoading: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  error: string;
  onRetry: () => void;
  onRefresh: () => void;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
  onUpdateVibe: (text: string) => Promise<boolean>;
  onSendComment: (text: string) => Promise<void>;
}>();

const activeTab = ref<LogiiTab>('track');

const comments = computed(() => props.data?.comments ?? []);
const images = computed(() => props.folder?.imageFiles ?? []);
const trackCount = computed(() => props.folder?.audioTracks.length ?? 0);
const chatCount = computed(() => comments.value.length);
const galleryCount = computed(() => images.value.length);

const logiiFileName = computed(() => props.folder?.logiiFileName ?? null);
const folderName = computed(() => (props.folder && !props.folder.isIntro ? props.folder.folderName : null));
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <LogiiPanelHeader
      :author-name="authorName"
      :folder-name="folderName"
      :logii-file-name="logiiFileName"
      :active-tab="activeTab"
      :is-refreshing="isRefreshing"
      :track-count="trackCount"
      :chat-count="chatCount"
      :gallery-count="galleryCount"
      @update:active-tab="activeTab = $event"
      @refresh="onRefresh()"
    />

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl px-4 py-4">
        <div v-if="!folder" class="py-10 text-center text-sm text-fg-muted">Выберите папку слева.</div>

        <div v-else-if="error" class="text-center py-10 text-sm text-red-400">
          {{ error }}
          <div class="mt-3">
            <button type="button" class="rounded-btn bg-card-bg px-3 py-1.5 text-xs" @click="onRetry()">
              Повторить
            </button>
          </div>
        </div>

        <template v-else>
          <LogiiTrackTab
            v-if="activeTab === 'track'"
            :folder="folder"
            :data="data"
            :is-loading-vibe="isLoading"
            :is-saving="isSaving"
            :update-vibe="onUpdateVibe"
            :on-play-track="onPlayTrack"
            :on-play-all="onPlayAll"
          />

          <LogiiChat
            v-else-if="activeTab === 'chat'"
            :comments="comments"
            :is-saving="isSaving"
            :is-loading="isLoading"
            :track-url-path="folder?.urlPath ?? ''"
            @send="onSendComment"
          />

          <LogiiGallery v-else-if="activeTab === 'gallery'" :images="images" />
        </template>
      </div>
    </div>
  </div>
</template>
