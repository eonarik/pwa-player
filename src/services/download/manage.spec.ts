// src/services/download/manage.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudTrackSource, LocalTrackSource, Track, TrackSource } from '@/types/track';
import type { TrackId } from '@/types/ids';
import type { ScanResult } from '@/plugins/types';
import type { PluginContext } from '@/plugins/types';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import { removeDownloaded, scanDownloads } from './manage';

const h = vi.hoisted(() => ({
  loadPlugin: vi.fn(async (_id: string): Promise<unknown> => ({})),
  createPluginContext: vi.fn((_id: string) => ({}) as unknown as PluginContext),
  updateTrackSources: vi.fn((_id: TrackId, _sources: TrackSource[]) => undefined),
  getPluginDir: vi.fn(async (_id: string) => ({ name: 'downloads' }) as unknown as FileSystemDirectoryHandle),
  removeDownloaded: vi.fn(
    async (_c: PluginContext, _t: Track, _s: TrackSource, _d: FileSystemDirectoryHandle) => undefined,
  ),
  scanDownloadDir: vi.fn(
    async (_c: PluginContext, _d: FileSystemDirectoryHandle) => undefined as unknown as ScanResult,
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

const PLUGIN_ID = 'yandex-disk';
const DIR = { name: 'downloads' } as unknown as FileSystemDirectoryHandle;
const CONTEXT = { id: 'ctx' } as unknown as PluginContext;

function localSource(): LocalTrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: `${PLUGIN_ID}:folder-1`,
    priority: 10,
    kind: 'local',
    handle: { name: 'track.mp3' } as unknown as FileSystemFileHandle,
    folderId: newFolderId(),
  };
}

function cloudSource(): CloudTrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: PLUGIN_ID,
    priority: 20,
    kind: 'cloud',
    remotePath: '/music/track.mp3',
    folderId: newFolderId(),
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

function stubPlugin(overrides: Record<string, unknown> = {}): void {
  h.loadPlugin.mockResolvedValue({
    id: PLUGIN_ID,
    canDownload: true,
    removeDownloaded: h.removeDownloaded,
    scanDownloadDir: h.scanDownloadDir,
    saveCache: h.saveCache,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubPlugin();
  h.createPluginContext.mockReturnValue(CONTEXT);
  h.getPluginDir.mockResolvedValue(DIR);
});

describe('removeDownloaded', () => {
  it('без локального источника — false, плагин не грузится', async () => {
    const track = makeTrack(cloudSource());

    expect(await removeDownloaded(track)).toBe(false);
    expect(h.loadPlugin).not.toHaveBeenCalled();
    expect(h.updateTrackSources).not.toHaveBeenCalled();
  });

  it('удаляет файл и снимает локальный источник, оставляя остальные', async () => {
    const local = localSource();
    const cloud = cloudSource();
    const track = makeTrack(local, cloud);

    expect(await removeDownloaded(track)).toBe(true);

    expect(h.removeDownloaded).toHaveBeenCalledWith(CONTEXT, track, local, DIR);
    expect(h.updateTrackSources).toHaveBeenCalledWith(track.id, [cloud]);
    expect(h.saveCache).toHaveBeenCalledWith(CONTEXT);
  });

  it('id плагина берётся из источника с усечением суффикса', async () => {
    await removeDownloaded(makeTrack(localSource()));

    expect(h.loadPlugin).toHaveBeenCalledWith(PLUGIN_ID);
    expect(h.createPluginContext).toHaveBeenCalledWith(PLUGIN_ID);
  });

  it('плагин без removeDownloaded — явная ошибка', async () => {
    stubPlugin({ removeDownloaded: undefined });

    await expect(removeDownloaded(makeTrack(localSource()))).rejects.toThrow(/does not support removing downloads/);
    expect(h.updateTrackSources).not.toHaveBeenCalled();
  });

  it('без saveCache удаление проходит', async () => {
    stubPlugin({ saveCache: undefined });

    expect(await removeDownloaded(makeTrack(localSource()))).toBe(true);
  });

  it('ошибка плагина пробрасывается, источники не меняются', async () => {
    h.removeDownloaded.mockRejectedValue(new Error('busy'));

    await expect(removeDownloaded(makeTrack(localSource()))).rejects.toThrow('busy');
    expect(h.updateTrackSources).not.toHaveBeenCalled();
  });
});

describe('scanDownloads', () => {
  it('плагин без scanDownloadDir — null', async () => {
    stubPlugin({ scanDownloadDir: undefined });

    expect(await scanDownloads(PLUGIN_ID)).toBeNull();
    expect(h.getPluginDir).not.toHaveBeenCalled();
  });

  it('результат скана возвращается как есть', async () => {
    const scan = { downloaded: new Map(), onlyLocal: [], missing: [] } as ScanResult;
    h.scanDownloadDir.mockResolvedValue(scan);

    expect(await scanDownloads(PLUGIN_ID)).toBe(scan);
    expect(h.scanDownloadDir).toHaveBeenCalledWith(CONTEXT, DIR);
  });

  it('сбой скана — null, а не исключение', async () => {
    h.scanDownloadDir.mockRejectedValue(new Error('no dir'));

    expect(await scanDownloads(PLUGIN_ID)).toBeNull();
  });

  it('id источника усекается до id плагина', async () => {
    await scanDownloads(`${PLUGIN_ID}:folder-1`);

    expect(h.loadPlugin).toHaveBeenCalledWith(PLUGIN_ID);
  });
});
