<!-- src/plugins/yandexSelf/logii/StreamSearchModal.vue -->

<script setup lang="ts">
import { ref, computed } from 'vue';
import { searchStreams, fetchCandidateAudio, candidateFileName, type SearchStreamsResult } from '@/plugins/searchStreams';
import type { SearchCandidate } from '@/plugins/types';
import Icon from '@/components/atoms/Icon.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { toastService } from '@/services/ui/ToastService';
import { logger } from '@/utils/logger';

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;

const props = defineProps<{
  folderUrlPath: string;
  takenNames: string[];
  /** Загрузить blob в папку Логий (реализация на стороне родителя). */
  onUpload: (fileName: string, blob: Blob) => Promise<void>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const query = ref('');
const isSearching = ref(false);
const isDownloading = ref(false);
const results = ref<SearchStreamsResult[]>([]);
const searched = ref(false);

const candidates = computed(() => {
  const all: Array<SearchCandidate & { pluginName: string }> = [];
  for (const r of results.value) {
    for (const c of r.candidates) {
      all.push({ ...c, pluginName: r.pluginName });
    }
  }
  return all;
});

const hasResults = computed(() => candidates.value.length > 0);
const canSearch = computed(() => query.value.trim().length > 0 && !isSearching.value);

async function doSearch(): Promise<void> {
  if (!canSearch.value) return;
  isSearching.value = true;
  searched.value = true;
  try {
    results.value = await searchStreams(query.value);
  } catch (err) {
    logger.error('[logii] stream search failed', err);
    toastService.error('Поиск не удался');
  } finally {
    isSearching.value = false;
  }
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function onAdd(candidate: SearchCandidate): Promise<void> {
  if (isDownloading.value) return;
  isDownloading.value = true;

  try {
    const blob = await fetchCandidateAudio(candidate);
    if (!blob) {
      toastService.error('Не удалось скачать трек');
      return;
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      toastService.error('Файл больше 30 МБ — загрузка невозможна');
      return;
    }

    const taken = new Set(props.takenNames);
    const fileName = candidateFileName(candidate, taken);
    await props.onUpload(fileName, blob);
    emit('close');
  } catch (err) {
    logger.error('[logii] add candidate failed', err);
    toastService.error(err instanceof Error ? err.message : 'Не удалось добавить трек');
  } finally {
    isDownloading.value = false;
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault();
    void doSearch();
  }
  if (e.key === 'Escape') {
    emit('close');
  }
}
</script>

<template>
  <div class="w-full max-w-lg rounded-card bg-bg-elevated p-5 shadow-xl">
    <div class="mb-3 flex items-start justify-between gap-4">
      <h2 class="text-lg font-medium text-fg">Найти в стримингах</h2>
      <button
        type="button"
        class="rounded-btn p-1 text-fg-muted transition hover:text-fg"
        aria-label="Закрыть"
        data-testid="stream-search-close"
        @click="emit('close')"
      >
        <Icon name="x" w="w-4" h="w-4" />
      </button>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex gap-2">
        <input
          v-model="query"
          type="text"
          placeholder="Артист или название трека…"
          class="flex-1 rounded-btn bg-card-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:bg-hover-bg focus:outline-none"
          :disabled="isSearching || isDownloading"
          data-testid="stream-search-input"
          @keydown="onKeydown"
        />
        <button
          type="button"
          class="rounded-btn bg-accent px-3 py-2 text-xs font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
          :disabled="!canSearch"
          data-testid="stream-search-submit"
          @click="doSearch"
        >
          <Spinner v-if="isSearching" size="sm" />
          <span v-else>Найти</span>
        </button>
      </div>

      <div v-if="isDownloading" class="flex items-center justify-center gap-2 py-6 text-xs text-fg-muted">
        <Spinner size="sm" />
        Скачиваем и загружаем на Диск…
      </div>

      <div
        v-else-if="hasResults"
        class="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-card bg-card-bg p-2"
        data-testid="stream-search-results"
      >
        <div
          v-for="(c, idx) in candidates"
          :key="`${c.pluginId}-${c.trackId}`"
          class="group flex items-center gap-3 rounded-btn px-2 py-1.5 transition hover:bg-hover-bg"
          :data-testid="`stream-candidate-${idx}`"
        >
          <img
            v-if="c.coverUrl"
            :src="c.coverUrl"
            alt=""
            class="h-9 w-9 shrink-0 rounded object-cover"
            loading="lazy"
          />
          <div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-hover-bg">
            <Icon name="album" w="w-4" h="h-4" class="text-fg-subtle" />
          </div>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-fg">{{ c.title }}</p>
            <p class="truncate text-xs text-fg-muted">
              {{ c.artist }}
              <span class="text-fg-subtle">· {{ c.pluginName }}</span>
            </p>
          </div>

          <span v-if="c.durationMs" class="shrink-0 text-xs tabular-nums text-fg-subtle">
            {{ formatDuration(c.durationMs) }}
          </span>

          <button
            type="button"
            class="shrink-0 rounded-btn bg-card-bg px-2 py-1 text-xs font-medium text-fg transition hover:bg-hover-bg disabled:opacity-50"
            :disabled="isDownloading"
            aria-label="Добавить в папку"
            :data-testid="`stream-candidate-add-${idx}`"
            @click="onAdd(c)"
          >
            <Icon name="plus" w="w-3.5" h="w-3.5" />
          </button>
        </div>
      </div>

      <div
        v-else-if="searched && !isSearching"
        class="py-6 text-center text-xs text-fg-muted"
        data-testid="stream-search-empty"
      >
        Ничего не найдено.
      </div>
    </div>
  </div>
</template>
