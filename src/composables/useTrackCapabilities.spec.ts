// src/composables/useTrackCapabilities.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Track } from '@/types/track';
import { asFolderId, asTrackSourceId, newTrackId } from '@/types/ids';
import { useTrackCapabilities } from './useTrackCapabilities';

const h = vi.hoisted(() => ({
  pluginCanDownload: vi.fn((_pluginId: string) => false),
  isLiveStream: vi.fn((_pluginId: string) => false),
  isLinearContent: vi.fn((_pluginId: string) => false),
  isStreamingPlugin: vi.fn((_pluginId: string) => false),
  pluginIdFromSource: vi.fn((pluginId: string) => `resolved:${pluginId}`),
}));

vi.mock('@/plugins/registry', () => h);

function trackWithSource(pluginId: string | null): Track {
  return {
    id: newTrackId(),
    pluginId: pluginId ?? 'local',
    artist: 'A',
    title: 'T',
    albumId: null,
    coverUrl: null,
    sources: pluginId
      ? [
          {
            id: asTrackSourceId('source-1'),
            pluginId,
            priority: 10,
            kind: 'local',
            handle: {} as FileSystemFileHandle,
            folderId: asFolderId('folder-1'),
          },
        ]
      : [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

function setup(pluginId: string | null = 'yandexDisk') {
  return useTrackCapabilities(ref(trackWithSource(pluginId)));
}

describe('useTrackCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pluginCanDownload.mockImplementation(() => true);
  });

  it('id источника резолвится через pluginIdFromSource', () => {
    const caps = setup();
    expect(caps.primaryPluginId.value).toBe('resolved:yandexDisk');
    expect(h.pluginIdFromSource).toHaveBeenCalledWith('yandexDisk');
  });

  it('без источников id пустой и скачивание запрещено', () => {
    const caps = setup(null);
    expect(caps.primaryPluginId.value).toBe('');
    expect(caps.canDownload.value).toBe(false);
    expect(h.pluginCanDownload).not.toHaveBeenCalled();
  });

  it('обычный файл со скачивающим плагином можно скачать', () => {
    const caps = setup();
    expect(caps.canDownload.value).toBe(true);
  });

  it('эфирные плагины не скачиваются', () => {
    h.isLiveStream.mockImplementation(() => true);
    const caps = setup();
    expect(caps.isLive.value).toBe(true);
    expect(caps.canDownload.value).toBe(false);
  });

  it('стриминговые плагины не скачиваются', () => {
    h.isStreamingPlugin.mockImplementation(() => true);
    const caps = setup();
    expect(caps.isStreaming.value).toBe(true);
    expect(caps.canDownload.value).toBe(false);
  });

  it('плагин без поддержки скачивания даёт false', () => {
    h.pluginCanDownload.mockImplementation(() => false);
    const caps = setup();
    expect(caps.canDownload.value).toBe(false);
  });

  it('флаги линейности и эфира читаются из id плагина', () => {
    h.isLinearContent.mockImplementation(() => true);
    const caps = setup();
    expect(caps.isLinear.value).toBe(true);
    expect(h.isLinearContent).toHaveBeenCalledWith('resolved:yandexDisk');
  });
});
