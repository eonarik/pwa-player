// src/services/metadata/MetadataService.applyCandidate.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { metadataService } from './MetadataService';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { isStreamingPlugin, loadPlugin } from '@/plugins/registry';
import { hasLocalSource, hasStreamingSource } from '@/services/library/selectors';
import type { Track } from '@/types/track';
import type { MetadataCandidate } from '@/types/metadata';
import { newFolderId, newMetadataCandidateId, newTrackId, newTrackSourceId } from '@/types/ids';

// Мокаем loadPlugin.
// Для 'zvuk' по умолчанию возвращаем плагин, который добавляет source (для сценариев D и E).
// В тесте на отключение мы переопределим этот мок через vi.mocked(loadPlugin).mockImplementation().
vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return {
    ...actual,
    loadPlugin: vi.fn(async (pluginId: string) => {
      if (pluginId === 'zvuk') {
        return {
          id: 'zvuk',
          applyCandidate: async (trackId: string, extMetadata: Record<string, unknown>) => {
            const library = useLibraryStore();
            const track = library.getTrack(trackId as never);
            if (!track) return;
            const zvukTrackId = typeof extMetadata.trackId === 'string' ? extMetadata.trackId : undefined;
            if (!zvukTrackId) return;
            const newSource = {
              id: newTrackSourceId(),
              pluginId: 'zvuk',
              priority: 30,
              kind: 'streaming' as const,
              url: `/api/zvuk/stream?id=${encodeURIComponent(zvukTrackId)}`,
            };
            createLibraryWriter().updateTrackSources(trackId as never, [newSource]);
          },
        };
      }
      return actual.loadPlugin(pluginId);
    }),
  };
});

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<MetadataCandidate> = {}): MetadataCandidate {
  return {
    id: newMetadataCandidateId(),
    artist: 'Zvuk Artist',
    title: 'Zvuk Title',
    album: 'Zvuk Album',
    coverUrl: 'https://zvuk.example/cover.jpg',
    similarity: 0.95,
    provider: 'zvuk',
    ...overrides,
  };
}

/**
 * ЦЕЛЕВОЕ ПОВЕДЕНИЕ (сценарий E):
 *
 * Если applyCandidate добавляет streaming-source от плагина,
 * то track.pluginId должен следовать за sources[0].pluginId.
 *
 * Раньше pluginId оставался прежним (imported), из-за чего UI показывал
 * неверные кнопки («Скачать»/«Редактировать вручную» вместо «Стрим»).
 */
describe('ЦЕЛЕВОЕ ПОВЕДЕНИЕ: applyCandidate без mergeWithTrackId (сценарий E)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('после applyCandidate (zvuk streaming) pluginId = "zvuk"', async () => {
    const library = useLibraryStore();

    // Импортированный трек (виртуальный, без реального источника)
    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'imported',
      artist: 'A',
      title: 'T',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'imported',
          priority: 999,
          kind: 'streaming',
          url: '',
        },
      ],
    });

    const candidate = makeCandidate({
      extMetadata: { trackId: 'zvuk-123' },
    });

    await metadataService.applyCandidate(trackId, candidate);

    const updated = library.getTrack(trackId);

    // После applyCandidate — sources = [zvuk streaming]
    expect(updated?.sources).toHaveLength(1);
    expect(updated?.sources[0]?.pluginId).toBe('zvuk');
    expect(hasStreamingSource(updated)).toBe(true);
    expect(hasLocalSource(updated)).toBe(false);

    // Инвариант: pluginId следует за sources[0].pluginId
    expect(updated?.pluginId).toBe('zvuk');
    expect(isStreamingPlugin(updated!.pluginId)).toBe(true);
    expect(isStreamingPlugin(updated!.pluginId)).toBe(hasStreamingSource(updated));
  });
});

describe('MetadataService.applyCandidate с mergeWithTrackId (сценарий D)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('target с local-source: sources сливаются, pluginId="local" сохраняется', async () => {
    const library = useLibraryStore();

    // 1. Целевой трек с local-source
    const targetId = newTrackId();
    const folderId = newFolderId();
    library.tracks[targetId] = makeTrack({
      id: targetId,
      pluginId: 'local',
      artist: 'Artist',
      title: 'Title',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'local',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId,
        },
      ],
    });

    // 2. Трек-кандидат (from merged-soft), у которого extMetadata.mergeWithTrackId = targetId
    const candidateTrackId = newTrackId();
    const candidate = makeCandidate({
      extMetadata: { mergeWithTrackId: targetId, trackId: 'zvuk-456' },
    });
    library.tracks[candidateTrackId] = makeTrack({
      id: candidateTrackId,
      pluginId: 'zvuk',
      artist: 'Artist',
      title: 'Title (variant)',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'zvuk',
          priority: 30,
          kind: 'streaming',
          url: '/api/zvuk/stream?id=456',
        },
      ],
      metadataCandidates: [candidate],
    });

    await metadataService.applyCandidate(candidateTrackId, candidate);

    // 3. Трек-кандидат удалён
    expect(library.getTrack(candidateTrackId)).toBeNull();

    // 4. Target получил sources от кандидата
    const updated = library.getTrack(targetId);
    expect(updated?.sources.length).toBeGreaterThanOrEqual(2);
    expect(updated?.sources.some((s) => s.kind === 'local')).toBe(true);
    expect(updated?.sources.some((s) => s.kind === 'streaming' && s.pluginId === 'zvuk')).toBe(true);

    // 5. pluginId остаётся 'local' — это правильно:
    //    у трека есть local primary-source, UI корректно скроет «Скачать» (local.canDownload = false).
    expect(updated?.pluginId).toBe('local');
    expect(isStreamingPlugin(updated!.pluginId)).toBe(false);
    expect(hasLocalSource(updated)).toBe(true);
  });
});

describe('MetadataService.applyCandidate: отключённый провайдер', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('НЕ вызывает plugin.applyCandidate, если плагин отключён', async () => {
    const library = useLibraryStore();
    const trackId = newTrackId();
    library.tracks[trackId] = makeTrack({
      id: trackId,
      pluginId: 'imported',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'imported',
          priority: 999,
          kind: 'streaming',
          url: '',
        },
      ],
    });

    const candidate = makeCandidate({
      provider: 'zvuk',
      extMetadata: { trackId: 'zvuk-123' },
    });

    // Переопределяем loadPlugin для этого теста.
    // Для 'zvuk' возвращаем отключённый плагин.
    // Для остальных (например, 'imported', который дергает saveCacheForTrack) — заглушку без applyCandidate.
    const disconnectedApplyCandidate = vi.fn();
    vi.mocked(loadPlugin).mockImplementation(async (pluginId: string) => {
      if (pluginId === 'zvuk') {
        return {
          id: 'zvuk',
          isDisconnected: () => true,
          applyCandidate: disconnectedApplyCandidate,
        } as any;
      }
      return { id: pluginId } as any;
    });

    await metadataService.applyCandidate(trackId, candidate);

    // updateManual всё равно применяется (метаданные), но source не должен добавиться
    const updated = library.getTrack(trackId);

    // Проверяем, что источник от Zvuk не добавился
    expect(updated?.sources.some((s) => s.pluginId === 'zvuk')).toBe(false);

    // И что сам applyCandidate у плагина не вызывался
    expect(disconnectedApplyCandidate).not.toHaveBeenCalled();
  });
});
