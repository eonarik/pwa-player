// src/services/download/active-downloads.spec.ts

import { describe, expect, it } from 'vitest';
import { computed } from 'vue';
import { createActiveDownloads } from './active-downloads';
import { newTrackId } from '@/types/ids';

describe('active-downloads', () => {
  it('begin регистрирует загрузку и выдаёт её состояние', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();

    const state = active.begin(trackId, new AbortController());

    expect(state.trackId).toBe(trackId);
    expect(state).toMatchObject({ written: 0, total: 0 });
    expect(active.has(trackId)).toBe(true);
  });

  it('reportProgress обновляет байты, getProgress отдаёт пару', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();
    active.begin(trackId, new AbortController());

    active.reportProgress(trackId, 512, 2048);

    expect(active.progressOf(trackId)).toEqual({ written: 512, total: 2048 });
  });

  it('resetProgress обнуляет счётчики перед повторной попыткой', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();
    active.begin(trackId, new AbortController());
    active.reportProgress(trackId, 512, 2048);

    active.resetProgress(trackId);

    expect(active.progressOf(trackId)).toEqual({ written: 0, total: 0 });
  });

  it('finish снимает трек с учёта, прогресс исчезает', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();
    active.begin(trackId, new AbortController());

    active.finish(trackId);

    expect(active.has(trackId)).toBe(false);
    expect(active.progressOf(trackId)).toBeNull();
  });

  it('прогресс несуществующего трека — no-op без выброса', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();

    expect(() => active.reportProgress(trackId, 1, 2)).not.toThrow();
    expect(() => active.resetProgress(trackId)).not.toThrow();
    expect(() => active.finish(trackId)).not.toThrow();
    expect(active.progressOf(trackId)).toBeNull();
  });

  it('abortControllerOf отдаёт контроллер загрузки и null для чужого трека', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();
    const abort = new AbortController();
    active.begin(trackId, abort);

    expect(active.abortControllerOf(trackId)).toBe(abort);
    expect(active.abortControllerOf(newTrackId())).toBeNull();

    // Так отменяется загрузка: отмена дошла до сигнала, состояние ещё на учёте.
    active.abortControllerOf(trackId)?.abort();
    expect(abort.signal.aborted).toBe(true);
    expect(active.has(trackId)).toBe(true);
  });

  it('изменения version заставляют computed-per-трек пересчитываться', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();

    // Именно так UI читает прогресс: computed, подписанный на version.
    const progress = computed(() => active.progressOf(trackId));
    const downloading = computed(() => active.has(trackId));

    expect(downloading.value).toBe(false);
    expect(progress.value).toBeNull();

    active.begin(trackId, new AbortController());
    expect(downloading.value).toBe(true);
    expect(progress.value).toEqual({ written: 0, total: 0 });

    active.reportProgress(trackId, 7, 70);
    expect(progress.value).toEqual({ written: 7, total: 70 });

    active.finish(trackId);
    expect(downloading.value).toBe(false);
    expect(progress.value).toBeNull();
  });

  it('version растёт на каждое изменение учёта', () => {
    const active = createActiveDownloads();
    const trackId = newTrackId();
    const before = active.version.value;

    active.begin(trackId, new AbortController());
    const afterBegin = active.version.value;
    expect(afterBegin).toBeGreaterThan(before);

    active.reportProgress(trackId, 1, 1);
    expect(active.version.value).toBeGreaterThan(afterBegin);
  });
});
