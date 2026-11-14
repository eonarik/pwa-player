<!-- src/plugins/yandexSelf/logii/LogiiPanel.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';
import LogiiPanelHeader, { type LogiiTab } from './LogiiPanelHeader.vue';
import LogiiTrackTab from './LogiiTrackTab.vue';
import LogiiChat from './LogiiChat.vue';
import LogiiGallery from './LogiiGallery.vue';
import LogiiIntroView from './LogiiIntroView.vue';

const props = defineProps<{
  authorName: string | null;
  folder: LogiiTrackItem | null;
  data: LogiiData | null;
  isLoading: boolean;
  isSaving: boolean;
  isRefreshing: boolean;
  error: string;
  canGoToParent: boolean;
  onRetry: () => void;
  onRefresh: () => void;
  onGoToParent: () => void;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
  onUpdateVibe: (text: string) => Promise<boolean>;
  onSendComment: (text: string) => Promise<void>;
  onUpdateComment: (index: number, text: string) => Promise<boolean>;
  onDeleteComment: (index: number) => Promise<boolean>;
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
      :can-go-to-parent="canGoToParent"
      :is-intro="Boolean(folder?.isIntro)"
      @update:active-tab="activeTab = $event"
      @refresh="onRefresh()"
      @go-to-parent="onGoToParent()"
    >
      <template #header-actions>
        <slot name="header-actions" />
      </template>
    </LogiiPanelHeader>

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
          <LogiiIntroView
            v-if="folder.isIntro"
            :folder="folder"
            :data="data"
            :is-loading="isLoading"
            :is-saving="isSaving"
            :on-update-vibe="onUpdateVibe"
            :on-send-comment="onSendComment"
            :on-update-comment="onUpdateComment"
            :on-delete-comment="onDeleteComment"
          />

          <template v-else>
            <template v-if="activeTab === 'track'">
              <LogiiTrackTab
                :folder="folder"
                :data="data"
                :is-loading-vibe="isLoading"
                :is-saving="isSaving"
                :update-vibe="onUpdateVibe"
                :on-play-track="onPlayTrack"
                :on-play-all="onPlayAll"
              />

              <LogiiChat
                class="mt-4"
                :comments="comments"
                :is-saving="isSaving"
                :is-loading="isLoading"
                :track-url-path="folder.urlPath"
                :on-update-comment="onUpdateComment"
                :on-delete-comment="onDeleteComment"
                @send="onSendComment"
              />
            </template>

            <LogiiGallery v-else :images="images" :folder="folder" />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
