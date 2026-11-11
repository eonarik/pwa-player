// src/components/library/metadata/useMetadataForm.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';
import type { Track } from '@/types/track';
import { newTrackId } from '@/types/ids';
import { useMetadataForm } from './useMetadataForm';
import type { MetadataCandidates } from './useMetadataCandidates';

const h = vi.hoisted(() => ({
  applyCandidate: vi.fn(async () => undefined),
  updateManual: vi.fn(() => undefined),
  confirm: vi.fn(),
  cancel: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/services/metadata/MetadataService', () => ({
  metadataService: { applyCandidate: h.applyCandidate, updateManual: h.updateManual },
}));
vi.mock('@/services/ui/ModalService', () => ({
  modalService: { confirm: h.confirm, cancel: h.cancel },
}));
vi.mock('@/services/ui/ToastService', () => ({
  toastService: { success: h.success, error: h.error },
}));

function trackStub(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'yandexDisk',
    artist: 'Original Artist',
    title: 'Original Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

function candidatesStub(overrides: Partial<MetadataCandidates> = {}): MetadataCandidates {
  return {
    candidates: ref([]),
    isLoading: ref(false),
    selectedIndex: overrides.selectedIndex ?? ref<number | null>(null),
    load: vi.fn(),
    select: vi.fn(),
    ...overrides,
  };
}

function libraryStub(
  overrides: {
    getAlbum?: (id: AlbumId) => Album | null;
    tracks?: Record<string, Track>;
  } = {},
) {
  return {
    getAlbum: overrides.getAlbum ?? ((_id: AlbumId) => null),
    tracks: overrides.tracks ?? {},
  };
}

describe('useMetadataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.applyCandidate.mockImplementation(async () => undefined);
  });

  it('исходные значения из трека', () => {
    const t = trackStub();
    const {
      artist,
      title,
      album: _album,
    } = useMetadataForm({
      track: ref(t),
      library: libraryStub(),
      candidates: candidatesStub(),
    });
    expect(artist.value).toBe('Original Artist');
    expect(title.value).toBe('Original Title');
    expect(_album.value).toBe('');
  });

  it('isDirty — true при изменении любого поля', () => {
    const { artist, isDirty } = useMetadataForm({
      track: ref(trackStub()),
      library: libraryStub(),
      candidates: candidatesStub(),
    });
    expect(isDirty.value).toBe(false);
    artist.value = 'New';
    expect(isDirty.value).toBe(true);
  });

  it('allArtists — уникальные, отсортированные артисты из библиотеки', () => {
    const t1 = trackStub({ artist: 'Zebra' });
    const t2 = trackStub({ artist: 'Alpha' });
    const t3 = trackStub({ artist: 'Alpha' });
    const lib = libraryStub({ tracks: { t1: t1, t2: t2, t3: t3 } });
    const { allArtists } = useMetadataForm({ track: ref(trackStub()), library: lib, candidates: candidatesStub() });
    expect(allArtists.value).toEqual(['Alpha', 'Zebra']);
  });

  it('save: название пусто — ошибка и никакого сохранения', async () => {
    const { save, title } = useMetadataForm({
      track: ref(trackStub()),
      library: libraryStub(),
      candidates: candidatesStub(),
    });
    title.value = '';
    await save();
    expect(h.error).toHaveBeenCalledTimes(1);
    expect(h.applyCandidate).not.toHaveBeenCalled();
    expect(h.updateManual).not.toHaveBeenCalled();
  });

  it('save: без кандидата — updateManual', async () => {
    await useMetadataForm({
      track: ref(trackStub({ title: 'New Title' })),
      library: libraryStub(),
      candidates: candidatesStub({ selectedIndex: ref(null) }),
    }).save();
    expect(h.updateManual).toHaveBeenCalledTimes(1);
    expect(h.confirm).toHaveBeenCalledTimes(1);
  });

  it('save: с выбранным кандидатом — applyCandidate', async () => {
    const cand = {
      id: 'c1' as never,
      artist: 'CandArtist',
      title: 'CandTitle',
      album: 'CandAlbum',
      coverUrl: null,
      similarity: 0.9,
      provider: 'iTunes',
    };
    await useMetadataForm({
      track: ref(trackStub({ title: 'New Title' })),
      library: libraryStub(),
      candidates: candidatesStub({ selectedIndex: ref(0), candidates: ref([cand]) }),
    }).save();
    expect(h.applyCandidate).toHaveBeenCalledTimes(1);
    expect(h.updateManual).not.toHaveBeenCalled();
  });
});
