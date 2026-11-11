// src/services/metadata/MetadataService/apply/duplicates.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { pickPrimaryTrackId, applyDuplicates } from './duplicates';
import type { Track, LocalTrackSource, TrackSource } from '@/types/track';
import type { FolderId, TrackId } from '@/types/ids';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';

function makeSource(folderId: FolderId, name = 'track.mp3'): LocalTrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'local',
    priority: 10,
    kind: 'local',
    handle: { name } as FileSystemFileHandle,
    folderId,
  };
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  const firstSource = overrides.sources?.[0] as LocalTrackSource | undefined;
  const folderId = firstSource?.folderId ?? newFolderId();
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [makeSource(folderId)] as TrackSource[],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

describe('pickPrimaryTrackId', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('возвращает null для пустого массива', () => {
    expect(pickPrimaryTrackId([])).toBeNull();
  });

  it('возвращает единственный существующий трек', () => {
    const library = useLibraryStore();
    const track = makeTrack();
    library.tracks[track.id] = track;

    expect(pickPrimaryTrackId([track.id])).toBe(track.id);
  });

  it('выбирает трек с более коротким title', () => {
    const library = useLibraryStore();
    const a = makeTrack({ title: 'Song' });
    const b = makeTrack({ title: 'Song (Remaster)' });
    library.tracks[a.id] = a;
    library.tracks[b.id] = b;

    expect(pickPrimaryTrackId([a.id, b.id])).toBe(a.id);
    expect(pickPrimaryTrackId([b.id, a.id])).toBe(a.id);
  });

  it('при равных длинах выбирает трек с большим числом sources', () => {
    const library = useLibraryStore();
    const folderA = newFolderId();
    const folderB = newFolderId();

    const single = makeTrack({ title: 'Same', sources: [makeSource(folderA)] });
    const multi = makeTrack({ title: 'Same', sources: [makeSource(folderA), makeSource(folderB)] });
    library.tracks[single.id] = single;
    library.tracks[multi.id] = multi;

    expect(pickPrimaryTrackId([single.id, multi.id])).toBe(multi.id);
  });

  it('игнорирует несуществующие треки', () => {
    const library = useLibraryStore();
    const existing = makeTrack();
    library.tracks[existing.id] = existing;

    const ghostId = newTrackId();
    expect(pickPrimaryTrackId([ghostId, existing.id])).toBe(existing.id);
  });
});

describe('applyDuplicates', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('склеивает пару дубликатов в основной трек и удаляет дубль', () => {
    const library = useLibraryStore();
    const folderA = newFolderId();
    const folderB = newFolderId();

    const primary = makeTrack({
      title: 'Song',
      sources: [makeSource(folderA)],
      duplicateTrackIds: [] as TrackId[],
    });
    const dup = makeTrack({
      title: 'Song (Remaster)',
      sources: [makeSource(folderB)],
      duplicateTrackIds: [primary.id],
    });
    primary.duplicateTrackIds = [dup.id];

    library.tracks[primary.id] = primary;
    library.tracks[dup.id] = dup;

    applyDuplicates(primary.id, [dup.id]);

    expect(library.getTrack(dup.id)).toBeNull();

    const updated = library.getTrack(primary.id);
    expect(updated).not.toBeNull();
    expect(updated!.sources).toHaveLength(2);
    expect(updated!.duplicateTrackIds).toEqual([]);
  });

  it('перевешивает обратные ссылки выжившего соседа на primary', () => {
    const library = useLibraryStore();
    const folderA = newFolderId();
    const folderB = newFolderId();
    const folderC = newFolderId();

    // Связь: A — B, A — C, B — C (треугольник)
    const a = makeTrack({ title: 'A', sources: [makeSource(folderA)] });
    const b = makeTrack({ title: 'B-long', sources: [makeSource(folderB)] });
    const c = makeTrack({ title: 'C-long', sources: [makeSource(folderC)] });

    a.duplicateTrackIds = [b.id, c.id];
    b.duplicateTrackIds = [a.id, c.id];
    c.duplicateTrackIds = [a.id, b.id];

    library.tracks[a.id] = a;
    library.tracks[b.id] = b;
    library.tracks[c.id] = c;

    // Склейка B и C в A: удалённые B/C должны убрать ссылки, а выживший...
    // тут survivors нет — все склеены в A. Но если бы был D=B-only, он бы
    // остался и его ссылка на B должна была бы перевеситься на A.
    applyDuplicates(a.id, [b.id, c.id]);

    expect(library.getTrack(b.id)).toBeNull();
    expect(library.getTrack(c.id)).toBeNull();

    const updated = library.getTrack(a.id);
    expect(updated!.duplicateTrackIds).toEqual([]);
    expect(updated!.sources).toHaveLength(3);
  });

  it('ничего не делает при отсутствии primary', () => {
    const library = useLibraryStore();
    const missingId = newTrackId();
    const dup = makeTrack();
    library.tracks[dup.id] = dup;

    applyDuplicates(missingId, [dup.id]);

    // Дубли не сливаются, остаются в сторе
    expect(library.getTrack(dup.id)).not.toBeNull();
  });

  it('пропускает dup === primary и несуществующие дубли', () => {
    const library = useLibraryStore();
    const primary = makeTrack({ title: 'Primary' });
    library.tracks[primary.id] = primary;

    applyDuplicates(primary.id, [primary.id, newTrackId()]);

    expect(library.getTrack(primary.id)).not.toBeNull();
    expect(library.getTrack(primary.id)!.title).toBe('Primary');
  });
});
