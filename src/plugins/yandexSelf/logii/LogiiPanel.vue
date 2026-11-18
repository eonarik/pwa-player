<!-- src/plugins/yandexSelf/logii/LogiiPanel.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';
import LogiiTrackTab from './LogiiTrackTab.vue';
import LogiiChat from './LogiiChat.vue';
import LogiiGallery from './LogiiGallery.vue';
import LogiiIntroView from './LogiiIntroView.vue';

export type LogiiTab = 'track' | 'gallery';

const props = defineProps<{
  folder: LogiiTrackItem | null;
  data: LogiiData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  isEditMode: boolean;
  isMobile?: boolean;
  activeTab: LogiiTab;
  onRetry: () => void;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
  onUpdateVibe: (text: string) => Promise<boolean>;
  onSendComment: (text: string) => Promise<void>;
  onUpdateComment: (index: number, text: string) => Promise<boolean>;
  onDeleteComment: (index: number) => Promise<boolean>;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: LogiiTab): void;
}>();

const TABS: Array<{ id: LogiiTab; label: string }> = [
  { id: 'track', label: 'Трек' },
  { id: 'gallery', label: 'Галерея' },
];

const comments = computed(() => props.data?.comments ?? []);
const images = computed(() => props.folder?.imageFiles ?? []);
const trackCount = computed(() => props.folder?.audioTracks.length ?? 0);
const galleryCount = computed(() => images.value.length);

function countFor(tab: LogiiTab): number {
  return tab === 'track' ? trackCount.value : galleryCount.value;
}
</script>

<template>
  <div class="w-full shrink-0 flex flex-col h-full bg-bg md:flex-1 md:min-w-0">
    <!-- Табы (только если это не Intro) -->
    <div
      v-if="folder && !folder.isIntro"
      class="flex w-full border-b border-hover-bg bg-bg shrink-0 md:px-4 md:py-2 md:gap-1.5"
    >
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        :data-testid="`logii-tab-${tab.id}`"
        class="text-xs font-medium transition flex items-center justify-center gap-1.5 flex-1 py-2.5 border-b-2 md:flex-none md:rounded-btn md:px-3 md:py-1.5 md:border-b-0"
        :class="
          activeTab === tab.id
            ? 'border-active text-active bg-active/5 md:bg-card-bg md:text-fg md:border-transparent'
            : 'border-transparent text-fg-muted hover:text-fg hover:bg-hover-bg'
        "
        @click="emit('update:activeTab', tab.id)"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="countFor(tab.id) > 0"
          class="rounded-full bg-hover-bg px-1.5 py-0.5 text-[10px]"
          :class="activeTab === tab.id ? 'md:bg-active/20 md:text-active' : ''"
        >
          {{ countFor(tab.id) }}
        </span>
      </button>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl px-4 py-4">
        <div v-if="!folder" class="py-10 text-center text-sm text-fg-muted">Выберите папку.</div>
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
            :is-edit-mode="isEditMode"
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
                :is-edit-mode="isEditMode"
                :is-mobile="isMobile"
                :update-vibe="onUpdateVibe"
                :on-play-track="onPlayTrack"
                :on-play-all="onPlayAll"
              />
              <LogiiChat
                class="mt-4"
                :comments="comments"
                :is-saving="isSaving"
                :is-loading="isLoading"
                :is-edit-mode="isEditMode"
                :track-url-path="folder.urlPath"
                :on-update-comment="onUpdateComment"
                :on-delete-comment="onDeleteComment"
                @send="onSendComment"
              />
            </template>
            <LogiiGallery v-else :images="images" :folder="folder" :is-edit-mode="isEditMode" />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
