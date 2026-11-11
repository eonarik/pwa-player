// src/services/download/batch.spec.ts

import { describe, expect, it, vi } from 'vitest';
import { createBatchRunner, selectDownloadable, type DownloadOne } from './batch';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import type { Track, TrackSource } from '@/types/track';

function cloudSource(): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'yandex-disk',
    priority: 20,
    kind: 'cloud',
    remotePath: '/music/track.mp3',
    folderId: newFolderId(),
  };
}

function localSource(): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'yandex-disk',
    priority: 10,
    kind: 'local',
    handle: { name: 'track.mp3' } as FileSystemFileHandle,
    folderId: newFolderId(),
  };
}

function streamingSource(): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'zvuk',
    priority: 30,
    kind: 'streaming',
    url: 'https://zvuk/stream',
  };
}

function makeTrack(title: string, sources: TrackSource[]): Track {
  return {
    id: newTrackId(),
    pluginId: 'yandex-disk',
    artist: 'Artist',
    title,
    albumId: null,
    coverUrl: null,
    sources,
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

function trackWithCloud(title: string): Track {
  return makeTrack(title, [cloudSource()]);
}

/** Управляемая задержка: тест сам решает, когда разблокировать загрузку. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('selectDownloadable', () => {
  it('берёт треки с cloud-источником без локального', () => {
    const downloadable = trackWithCloud('нужен');

    expect(selectDownloadable([downloadable])).toEqual([downloadable]);
  });

  it('пропускает уже скачанный (cloud + local)', () => {
    const already = makeTrack('уже скачан', [cloudSource(), localSource()]);

    expect(selectDownloadable([already])).toEqual([]);
  });

  it('пропускает трек без cloud-источника (только streaming)', () => {
    expect(selectDownloadable([makeTrack('стрим', [streamingSource()])])).toEqual([]);
  });

  it('сохраняет исходный порядок', () => {
    const a = trackWithCloud('a');
    const b = trackWithCloud('b');

    expect(selectDownloadable([b, a]).map((t) => t.title)).toEqual(['b', 'a']);
  });
});

describe('downloadMany', () => {
  it('качает только отобранные и считает пропущенные', async () => {
    const wanted = [trackWithCloud('x'), trackWithCloud('y')];
    const skippedTracks = [makeTrack('local', [localSource()]), makeTrack('stream', [streamingSource()])];
    const downloaded: string[] = [];
    const downloadOne: DownloadOne = async (track) => {
      downloaded.push(track.title);
    };

    const runner = createBatchRunner(downloadOne);
    const result = await runner.downloadMany([...wanted, ...skippedTracks]);

    expect(downloaded).toEqual(['x', 'y']);
    expect(result).toMatchObject({ succeeded: 2, failed: 0, skipped: 2, aborted: false });
    expect(result.errors).toEqual([]);
  });

  it('при пустом отборе не запускает батч, но возвращает skipped', async () => {
    const downloadOne = vi.fn<DownloadOne>();
    const runner = createBatchRunner(downloadOne);

    const result = await runner.downloadMany([makeTrack('local', [localSource()])]);

    expect(downloadOne).not.toHaveBeenCalled();
    expect(result).toMatchObject({ succeeded: 0, failed: 0, skipped: 1, aborted: false });
    expect(runner.isBatchDownloading.value).toBe(false);
  });

  it('ошибка одного трека не прерывает батч, ошибка собирается', async () => {
    const downloadOne: DownloadOne = async (track) => {
      if (track.title === 'bad') {
        throw new Error('нет доступа');
      }
    };
    const runner = createBatchRunner(downloadOne);

    const result = await runner.downloadMany([trackWithCloud('bad'), trackWithCloud('good')]);

    expect(result).toMatchObject({ succeeded: 1, failed: 1, aborted: false });
    expect(result.errors).toEqual([{ track: expect.objectContaining({ title: 'bad' }), message: 'нет доступа' }]);
  });

  it('не-Error thrown попадает в сообщения как строка', async () => {
    const downloadOne: DownloadOne = async () => {
      throw 'сбой';
    };
    const runner = createBatchRunner(downloadOne);

    const result = await runner.downloadMany([trackWithCloud('x')]);

    expect(result.errors[0]?.message).toBe('сбой');
  });

  it('AbortError от трека останавливает батч и помечает aborted', async () => {
    const downloaded: string[] = [];
    const downloadOne: DownloadOne = async (track) => {
      downloaded.push(track.title);
      if (track.title === 'первый') {
        throw new DOMException('Aborted', 'AbortError');
      }
    };
    const runner = createBatchRunner(downloadOne);

    const result = await runner.downloadMany([trackWithCloud('первый'), trackWithCloud('второй')]);

    expect(downloaded).toEqual(['первый']);
    expect(result).toMatchObject({ succeeded: 0, failed: 0, aborted: true });
  });

  it('cancelBatch во время загрузки пропускает оставшиеся треки', async () => {
    const downloaded: string[] = [];
    const runner = createBatchRunner(async (track) => {
      downloaded.push(track.title);
      runner.cancelBatch();
    });

    const result = await runner.downloadMany([trackWithCloud('первый'), trackWithCloud('второй')]);

    expect(downloaded).toEqual(['первый']);
    expect(result).toMatchObject({ succeeded: 1, aborted: true });
  });

  it('cancelBatch без активного батча — no-op', async () => {
    const runner = createBatchRunner(async () => undefined);

    expect(() => runner.cancelBatch()).not.toThrow();
    expect(runner.isBatchDownloading.value).toBe(false);
  });

  it('параллельный вызов downloadMany игнорируется', async () => {
    const gate = deferred();
    const calls: string[] = [];

    const runner = createBatchRunner(async (track) => {
      calls.push(track.title);
      if (track.title === 'занятый') {
        await gate.promise;
      }
    });

    const pending = runner.downloadMany([trackWithCloud('занятый')]);
    expect(runner.isBatchDownloading.value).toBe(true);

    const concurrent = await runner.downloadMany([trackWithCloud('второй')]);

    expect(concurrent).toMatchObject({ succeeded: 0, failed: 0, skipped: 0, aborted: false });
    expect(calls).toEqual(['занятый']);

    gate.resolve();
    await pending;
    expect(calls).toEqual(['занятый']);
  });

  it('прогресс отражает текущий трек и сбрасывается по завершении', async () => {
    const seen: Array<string | null> = [];
    const runner = createBatchRunner(async () => {
      seen.push(runner.batchProgress.value?.currentName ?? null);
    });

    await runner.downloadMany([trackWithCloud('первый'), trackWithCloud('второй')]);

    expect(seen).toEqual(['первый', 'второй']);
    expect(runner.batchProgress.value).toBeNull();
    expect(runner.isBatchDownloading.value).toBe(false);
  });

  it('done считает и успешные, и ошибочные треки', async () => {
    const snapshots: Array<{ done: number; total: number }> = [];
    const runner = createBatchRunner(async (track) => {
      const current = runner.batchProgress.value;
      if (current) {
        snapshots.push({ done: current.done, total: current.total });
      }
      if (track.title === 'bad') {
        throw new Error('сбой');
      }
    });

    await runner.downloadMany([trackWithCloud('bad'), trackWithCloud('good')]);

    // Перед первым: 0 обработано. Перед вторым: 1 (первый упал — тоже обработан).
    expect(snapshots).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
    ]);
  });

  it('пустой вход даёт нулевой результат', async () => {
    const runner = createBatchRunner(async () => undefined);

    expect(await runner.downloadMany([])).toMatchObject({ succeeded: 0, failed: 0, skipped: 0, aborted: false });
  });
});
