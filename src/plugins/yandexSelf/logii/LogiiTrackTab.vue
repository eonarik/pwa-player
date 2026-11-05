<!-- src/plugins/yandexSelf/logii/LogiiTrackTab.vue -->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import TrackListItem from '@/components/library/TrackListItem.vue';
import TrackActions from '@/components/library/TrackActions.vue';
import Icon from '@/components/ui/Icon.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { LogiiTrackItem } from './useLogiiData';
import type { LogiiData } from './parseLogii';

const props = defineProps<{
  folder: LogiiTrackItem;
  data: LogiiData | null;
  isLoadingVibe: boolean;
  isSaving: boolean;
  updateVibe: (text: string) => Promise<boolean>;
  onPlayTrack: (index: number) => void;
  onPlayAll: () => void;
}>();

const player = usePlayerStore();
const { currentTrack, isPlaying } = storeToRefs(player);

const isEditingVibe = ref(false);
const vibeDraft = ref('');
const vibeTextareaRef = ref<HTMLTextAreaElement | null>(null);

const VIBE_MIN_ROWS = 1;
const VIBE_MAX_ROWS = 10;

const currentVibe = computed(() => props.data?.vibe ?? '');
const tracks = computed(() => props.folder.audioTracks);

const vibeTitle = computed(() => {
  if (props.folder.isIntro && props.folder.logiiFileName) {
    return props.folder.logiiFileName;
  }
  return 'Vibe';
});

function autosizeVibe(): void {
  const el = vibeTextareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const style = window.getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const paddingBottom = parseFloat(style.paddingBottom) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;
  const rows = Math.max(VIBE_MIN_ROWS, Math.min(VIBE_MAX_ROWS, Math.ceil(el.scrollHeight / lineHeight)));
  const height = rows * lineHeight + paddingTop + paddingBottom + borderTop + borderBottom;
  el.style.height = `${height}px`;
  el.style.overflowY = rows >= VIBE_MAX_ROWS ? 'auto' : 'hidden';
}

function startEdit(): void {
  vibeDraft.value = currentVibe.value;
  isEditingVibe.value = true;
  nextTick(() => autosizeVibe());
}

function cancelEdit(): void {
  isEditingVibe.value = false;
  vibeDraft.value = '';
}

async function saveVibe(): Promise<void> {
  const ok = await props.updateVibe(vibeDraft.value);
  if (ok) isEditingVibe.value = false;
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId;
}

watch(
  () => isEditingVibe.value,
  (editing) => {
    if (editing) nextTick(() => autosizeVibe());
  },
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="tracks.length > 0">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-fg">Аудио</p>
        <button
          type="button"
          class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
          @click="props.onPlayAll()"
        >
          <Icon name="play" w="w-3.5" h="h-3.5" class="mr-1 inline" />
          Играть всё
        </button>
      </div>

      <div class="flex flex-col gap-0.5">
        <TrackListItem
          v-for="(track, index) in tracks"
          :key="track.id"
          :track="track"
          :index="index"
          :is-current="isCurrent(track.id)"
          :is-playing="isPlaying"
          @select="() => props.onPlayTrack(index)"
        >
          <template #actions>
            <TrackActions :track="track" />
          </template>
        </TrackListItem>
      </div>
    </div>
    <p v-else class="text-xs text-fg-muted">Нет аудио в этой папке.</p>

    <!-- Vibe -->
    <div class="rounded-card bg-card-bg p-4">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-fg">{{ vibeTitle }}</p>
        <button
          v-if="!isEditingVibe && !isLoadingVibe"
          type="button"
          class="rounded-btn bg-card-bg px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg"
          @click="startEdit"
        >
          <Icon name="pencil" w="w-3.5" h="h-3.5" class="mr-1 inline" />
          {{ currentVibe ? 'Редактировать' : 'Написать' }}
        </button>
      </div>

      <div v-if="isLoadingVibe" class="flex items-center gap-2 text-xs text-fg-muted">
        <Spinner size="sm" />
        Загружаем Vibe…
      </div>

      <template v-else-if="isEditingVibe">
        <textarea
          ref="vibeTextareaRef"
          v-model="vibeDraft"
          :rows="VIBE_MIN_ROWS"
          class="w-full rounded-btn bg-bg-elevated px-3 py-2 text-sm text-fg focus:outline-none"
          placeholder="Опиши вайб трека…"
          @input="autosizeVibe"
        />
        <div class="mt-2 flex justify-end gap-2">
          <button type="button" class="rounded-btn px-3 py-1 text-xs text-fg-muted hover:text-fg" @click="cancelEdit">
            Отмена
          </button>
          <button
            type="button"
            class="rounded-btn bg-accent px-3 py-1 text-xs font-medium text-bg hover:bg-accent-hover disabled:opacity-50"
            :disabled="isSaving"
            @click="saveVibe"
          >
            {{ isSaving ? 'Сохраняем…' : 'Сохранить' }}
          </button>
        </div>
      </template>

      <p v-else-if="currentVibe" class="whitespace-pre-line text-sm text-fg">{{ currentVibe }}</p>
      <p v-else class="text-xs text-fg-muted">
        Vibe пока нет. Напиши первый комментарий — файл создастся автоматически.
      </p>
    </div>
  </div>
</template>
