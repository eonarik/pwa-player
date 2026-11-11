// src/services/download/active-downloads.ts

import { ref, shallowRef, type Ref } from 'vue';
import type { TrackId } from '@/types/ids';
import type { TrackDownloadState } from './types';

export interface DownloadProgress {
  written: number;
  total: number;
}

/**
 * Реестр активных загрузок: трек → его состояние (прогресс + AbortController).
 *
 * Реактивность: `states` — shallowRef<Map>, поэтому `map.set()/delete()` и
 * мутация `state.written` Vue не видят. Каждое изменение сопровождается
 * `version++`, а читающие методы подписываются на `version` — так UI
 * (TrackRow, TrackActions, useTrackDownload) перерисовывается на прогресс.
 */
export interface ActiveDownloads {
  readonly version: Ref<number>;

  /** Регистрирует загрузку и возвращает её состояние. */
  begin(trackId: TrackId, abort: AbortController): TrackDownloadState;
  /** Обновляет байтовый прогресс; no-op, если загрузка уже снята с учёта. */
  reportProgress(trackId: TrackId, written: number, total: number): void;
  /** Обнуляет прогресс (перед новой попыткой после ошибки). */
  resetProgress(trackId: TrackId): void;
  /** Снимает загрузку с учёта. Вызывается в finally — всегда. */
  finish(trackId: TrackId): void;

  has(trackId: TrackId): boolean;
  progressOf(trackId: TrackId): DownloadProgress | null;
  abortControllerOf(trackId: TrackId): AbortController | null;
}

export function createActiveDownloads(): ActiveDownloads {
  const states = shallowRef<Map<TrackId, TrackDownloadState>>(new Map());
  const version = ref(0);

  const bump = (): void => {
    version.value++;
  };

  return {
    version,

    begin(trackId, abort) {
      const state: TrackDownloadState = { trackId, written: 0, total: 0, abort };
      states.value.set(trackId, state);
      bump();
      return state;
    },

    reportProgress(trackId, written, total) {
      void version.value;
      const state = states.value.get(trackId);
      if (!state) return;
      state.written = written;
      state.total = total;
      bump();
    },

    resetProgress(trackId) {
      void version.value;
      const state = states.value.get(trackId);
      if (!state) return;
      state.written = 0;
      state.total = 0;
      bump();
    },

    finish(trackId) {
      states.value.delete(trackId);
      bump();
    },

    has(trackId) {
      void version.value;
      return states.value.has(trackId);
    },

    progressOf(trackId) {
      void version.value;
      const state = states.value.get(trackId);
      if (!state) return null;
      return { written: state.written, total: state.total };
    },

    abortControllerOf(trackId) {
      void version.value;
      return states.value.get(trackId)?.abort ?? null;
    },
  };
}
