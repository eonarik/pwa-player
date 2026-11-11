// src/services/download/single-track.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudTrackSource, LocalTrackSource, Track, TrackSource } from '@/types/track';
import type { TrackId } from '@/types/ids';
import type { DownloadTrackOptions, DownloadedTrackInfo, PluginContext } from '@/plugins/types';
import type { ParsedId3, TrackMetadata } from '@/services/metadata/types';
import type { DownloadProgress } from './active-downloads';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import { DownloadError } from './types';
import { createActiveDownloads } from './active-downloads';
import { downloadTrackInternal, MAX_DOWNLOAD_ATTEMPTS } from './single-track';

/**
 * Шпионы создаются в vi.hoisted (до исполнения импортов), поэтому опираются
 * только на стёртые типы и литералы. Типизация сигнатур даёт проверенные
 * `mock.calls` без кастов в тестах.
 */
const h = vi.hoisted(() => ({
  loadPlugin: vi.fn(async (_id: string): Promise<unknown> => ({})),
  createPluginContext: vi.fn((_id: string) => ({}) as unknown as PluginContext),
  updateTrackSources: vi.fn((_id: TrackId, _sources: TrackSource[]) => undefined),
  getPluginDir: vi.fn(async (_id: string) => ({ name: 'downloads' }) as unknown as FileSystemDirectoryHandle),
  parse: vi.fn(async (_file: File) => null as ParsedId3 | null),
  applyFromFile: vi.fn((_id: TrackId, _meta: TrackMetadata, _cover: Blob | null) => undefined),
  downloadTrack: vi.fn(
    async (_c: PluginContext, _t: Track, _s: TrackSource, _o: DownloadTrackOptions): Promise<DownloadedTrackInfo> => ({
      relativePath: 'music/track.mp3',
      size: 1024,
      handle: { name: 'track.mp3' } as unknown as FileSystemFileHandle,
    }),
  ),
  saveCache: vi.fn(async (_c: PluginContext) => undefined),
}));

vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return { ...actual, loadPlugin: h.loadPlugin };
});
vi.mock('@/plugins/context', () => ({ createPluginContext: h.createPluginContext }));
vi.mock('@/stores/library', () => ({
  createLibraryWriter: () => ({ updateTrackSources: h.updateTrackSources }),
}));
vi.mock('./DownloadSpaceService', () => ({ downloadSpaceService: { getPluginDir: h.getPluginDir } }));
vi.mock('../metadata/MetadataWorkerService', () => ({ metadataWorkerService: { parse: h.parse } }));
vi.mock('../metadata/MetadataService', () => ({ metadataService: { applyFromFile: h.applyFromFile } }));

const PLUGIN_ID = 'yandex-disk';

/** Стаб handle: getFile нужен, чтобы путь разбора тегов доходил до parse. */
const handle = (): FileSystemFileHandle =>
  ({
    name: 'track.mp3',
    getFile: async () => ({ name: 'track.mp3' }) as unknown as File,
  }) as unknown as FileSystemFileHandle;

const info = (): DownloadedTrackInfo => ({ relativePath: 'music/track.mp3', size: 1024, handle: handle() });

function cloudSource(): CloudTrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: `${PLUGIN_ID}:folder-1`,
    priority: 20,
    kind: 'cloud',
    remotePath: '/music/track.mp3',
    folderId: newFolderId(),
  };
}

function localSource(): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: PLUGIN_ID,
    priority: 10,
    kind: 'local',
    handle: handle(),
    folderId: newFolderId(),
  };
}

function streamingSource(): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'zvuk',
    priority: 5,
    kind: 'streaming',
    url: 'https://zvuk/stream',
  };
}

function makeTrack(...sources: TrackSource[]): Track {
  return {
    id: newTrackId(),
    pluginId: PLUGIN_ID,
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources,
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
  };
}

function parsedWithArtist(): ParsedId3 {
  return {
    metadata: { artist: 'Artist', title: 'Title', album: 'Album', hasId3Tags: true },
    coverBlob: null,
  };
}

function download(track: Track, signal: AbortSignal | null = null, retryDelayMs = 0) {
  const active = createActiveDownloads();
  return { active, promise: downloadTrackInternal(track, signal, { active, retryDelayMs }) };
}

const writtenSources = (): TrackSource[] => h.updateTrackSources.mock.calls[0]?.[1] ?? [];

const asLocal = (sources: TrackSource[]): LocalTrackSource | undefined =>
  sources.find((s): s is LocalTrackSource => s.kind === 'local');

/** Управляемая задержка: даёт тесту дождаться реального старта загрузки. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Базовые реализации задаются явно каждый раз: mockImplementation перекрывает
  // то, что могло остаться из предыдущего теста.
  h.loadPlugin.mockResolvedValue({
    id: PLUGIN_ID,
    canDownload: true,
    downloadTrack: h.downloadTrack,
    saveCache: h.saveCache,
  });
  h.downloadTrack.mockImplementation(async () => info());
  h.parse.mockResolvedValue(parsedWithArtist());
});

describe('предусловия', () => {
  it('без cloud-источника — ошибка, плагин не грузится', async () => {
    const track = makeTrack(localSource());
    const { active, promise } = download(track);

    await expect(promise).rejects.toThrow(/has no cloud source to download/);
    expect(h.loadPlugin).not.toHaveBeenCalled();
    expect(active.has(track.id)).toBe(false);
  });

  it('плагин без canDownload — ошибка, скачивание не начинается', async () => {
    h.loadPlugin.mockResolvedValue({ id: PLUGIN_ID, canDownload: false });

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow(/does not support download/);
    expect(h.downloadTrack).not.toHaveBeenCalled();
  });

  it('canDownload есть, метода downloadTrack нет — та же ошибка', async () => {
    h.loadPlugin.mockResolvedValue({ id: PLUGIN_ID, canDownload: true });

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow(/does not support download/);
  });

  it('id источника усекается до id плагина', async () => {
    await download(makeTrack(cloudSource())).promise;

    expect(h.loadPlugin).toHaveBeenCalledWith(PLUGIN_ID);
    expect(h.createPluginContext).toHaveBeenCalledWith(PLUGIN_ID);
  });

  it('внешний сигнал уже отменён — плагин не вызывается', async () => {
    const controller = new AbortController();
    controller.abort();
    const track = makeTrack(cloudSource());
    const { active, promise } = download(track, controller.signal);

    await expect(promise).rejects.toThrow('Aborted');
    expect(h.downloadTrack).not.toHaveBeenCalled();
    expect(active.has(track.id)).toBe(false);
  });
});

describe('успешное скачивание', () => {
  it('во время загрузки трек учтён, после — снят с учёта', async () => {
    const track = makeTrack(cloudSource());
    const active = createActiveDownloads();
    let during: boolean | null = null;

    h.downloadTrack.mockImplementation(async (_c, t, _s, options) => {
      during = active.has(t.id);
      options.onProgress?.(300, 1000);
      return info();
    });

    await downloadTrackInternal(track, null, { active, retryDelayMs: 0 });

    expect(during).toBe(true);
    expect(active.has(track.id)).toBe(false);
  });

  it('прогресс плагина виден в реестре активных загрузок', async () => {
    const track = makeTrack(cloudSource());
    const active = createActiveDownloads();
    let observed: DownloadProgress | null = null;

    h.downloadTrack.mockImplementation(async (_c, t, _s, options) => {
      options.onProgress?.(300, 1000);
      observed = active.progressOf(t.id);
      return info();
    });

    await downloadTrackInternal(track, null, { active, retryDelayMs: 0 });

    expect(observed).toEqual({ written: 300, total: 1000 });
  });

  it('локальный источник добавлен, порядок источников по priority', async () => {
    const cloud = cloudSource();
    const track = makeTrack(cloud, streamingSource());

    await download(track).promise;

    expect(h.updateTrackSources).toHaveBeenCalledTimes(1);
    expect(h.updateTrackSources.mock.calls[0]?.[0]).toBe(track.id);

    const sources = writtenSources();
    expect(sources.map((s) => s.kind)).toEqual(['streaming', 'local', 'cloud']);
    expect(asLocal(sources)).toMatchObject({ priority: 10, pluginId: PLUGIN_ID, folderId: cloud.folderId });
  });

  it('старый локальный источник заменяется, а не дублируется', async () => {
    await download(makeTrack(localSource(), cloudSource())).promise;

    expect(writtenSources().filter((s) => s.kind === 'local')).toHaveLength(1);
  });

  it('парсит теги и применяет их, когда локального источника не было', async () => {
    const track = makeTrack(cloudSource());

    await download(track).promise;

    expect(h.applyFromFile).toHaveBeenCalledWith(track.id, expect.objectContaining({ artist: 'Artist' }), null);
  });

  it('не парсит теги, если первым уже стоит локальный источник', async () => {
    await download(makeTrack(localSource(), cloudSource())).promise;

    expect(h.parse).not.toHaveBeenCalled();
    expect(h.applyFromFile).not.toHaveBeenCalled();
  });

  it('пустой artist из тегов — метаданные не применяются', async () => {
    h.parse.mockResolvedValue({
      metadata: { artist: '', title: 'T', album: '', hasId3Tags: false },
      coverBlob: null,
    });

    await download(makeTrack(cloudSource())).promise;

    expect(h.applyFromFile).not.toHaveBeenCalled();
  });

  it('сбой разбора тегов не срывает загрузку', async () => {
    h.parse.mockRejectedValue(new Error('broken file'));
    const track = makeTrack(cloudSource());

    await expect(download(track).promise).resolves.toBeUndefined();
    expect(h.updateTrackSources).toHaveBeenCalledTimes(1);
  });

  it('обложка из ID3 передаётся в applyFromFile', async () => {
    const blob = new Blob(['img']);
    h.parse.mockResolvedValue({ metadata: parsedWithArtist().metadata, coverBlob: blob });
    const track = makeTrack(cloudSource());

    await download(track).promise;

    expect(h.applyFromFile).toHaveBeenCalledWith(track.id, expect.anything(), blob);
  });

  it('сохраняет кеш плагина', async () => {
    await download(makeTrack(cloudSource())).promise;

    expect(h.saveCache).toHaveBeenCalledTimes(1);
  });

  it('без saveCache у плагина загрузка проходит', async () => {
    h.loadPlugin.mockResolvedValue({ id: PLUGIN_ID, canDownload: true, downloadTrack: h.downloadTrack });

    await expect(download(makeTrack(cloudSource())).promise).resolves.toBeUndefined();
  });
});

describe('повторы', () => {
  it('первая попытка упала, вторая успешна', async () => {
    h.downloadTrack.mockRejectedValueOnce(new Error('temporary'));

    await expect(download(makeTrack(cloudSource())).promise).resolves.toBeUndefined();
    expect(h.downloadTrack).toHaveBeenCalledTimes(2);
  });

  it('после неудачной попытки прогресс обнуляется', async () => {
    const track = makeTrack(cloudSource());
    const active = createActiveDownloads();
    const seen: Array<DownloadProgress | null> = [];
    let attempts = 0;

    h.downloadTrack.mockImplementation(async (_c, t, _s, options) => {
      attempts++;
      seen.push(active.progressOf(t.id));
      options.onProgress?.(400, 1000);
      if (attempts === 1) {
        throw new Error('temporary');
      }
      return info();
    });

    await downloadTrackInternal(track, null, { active, retryDelayMs: 0 });

    // Первая попытка: 0/0. Вторая: снова 0/0, хотя до ошибки было 400/1000.
    expect(seen).toEqual([
      { written: 0, total: 0 },
      { written: 0, total: 0 },
    ]);
  });

  it('исчерпание попыток бросает последнюю ошибку', async () => {
    h.downloadTrack.mockRejectedValue(new Error('always down'));

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow('always down');
    expect(h.downloadTrack).toHaveBeenCalledTimes(MAX_DOWNLOAD_ATTEMPTS);
  });

  it('404 не повторяется', async () => {
    h.downloadTrack.mockRejectedValue(new DownloadError(404, 'not found'));

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow('not found');
    expect(h.downloadTrack).toHaveBeenCalledTimes(1);
  });

  it('410 не повторяется', async () => {
    h.downloadTrack.mockRejectedValue(new DownloadError(410, 'gone'));

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow('gone');
    expect(h.downloadTrack).toHaveBeenCalledTimes(1);
  });

  it('5xx повторяется', async () => {
    h.downloadTrack.mockRejectedValue(new DownloadError(503, 'unavailable'));

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow('unavailable');
    expect(h.downloadTrack).toHaveBeenCalledTimes(MAX_DOWNLOAD_ATTEMPTS);
  });

  it('AbortError из плагина не порождает повторов', async () => {
    h.downloadTrack.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await expect(download(makeTrack(cloudSource())).promise).rejects.toThrow('Aborted');
    expect(h.downloadTrack).toHaveBeenCalledTimes(1);
  });
});

describe('отмена', () => {
  it('внешняя отмена во время загрузки пробрасывается в сигнал плагина', async () => {
    const controller = new AbortController();
    const started = deferred();
    let sawAbort = false;

    h.downloadTrack.mockImplementation((_c, _t, _s, options) => {
      started.resolve();
      return new Promise<DownloadedTrackInfo>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          sawAbort = true;
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const { promise } = download(makeTrack(cloudSource()), controller.signal);
    await started.promise;
    controller.abort();

    await expect(promise).rejects.toThrow('Aborted');
    expect(sawAbort).toBe(true);
  });

  it('отмена во время паузы перед повтором обрывает повторы', async () => {
    const controller = new AbortController();
    let attempts = 0;

    h.downloadTrack.mockImplementation(async () => {
      attempts++;
      setTimeout(() => controller.abort(), 0);
      throw new Error('temporary');
    });

    const { promise } = download(makeTrack(cloudSource()), controller.signal, 50);

    await expect(promise).rejects.toThrow('Aborted');
    expect(attempts).toBe(1);
  });

  it('после отмены загрузка снята с учёта', async () => {
    const track = makeTrack(cloudSource());
    const controller = new AbortController();
    const active = createActiveDownloads();

    h.downloadTrack.mockImplementation(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });

    await expect(downloadTrackInternal(track, controller.signal, { active, retryDelayMs: 0 })).rejects.toThrow(
      'Aborted',
    );
    expect(active.has(track.id)).toBe(false);
  });
});
