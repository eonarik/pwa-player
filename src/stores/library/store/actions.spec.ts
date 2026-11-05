// src/stores/library/store/actions.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLibraryStore } from './index';

// Используем vi.hoisted, чтобы переменная была доступна до применения моков
const mocks = vi.hoisted(() => {
  return {
    mockAlbumId: 'mock-album-id-1234',
    loadAll: vi.fn(),
    clear: vi.fn(),
    save: vi.fn(),
  };
});

vi.mock('@/services/persistence/AlbumService', () => ({
  albumService: {
    loadAll: mocks.loadAll,
    clear: mocks.clear,
    save: mocks.save,
  },
}));

describe('library.restore: Album.coverBlob', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Настраиваем мок перед каждым тестом
    mocks.loadAll.mockResolvedValue({
      [mocks.mockAlbumId]: {
        id: mocks.mockAlbumId,
        name: 'A',
        artist: 'Art',
        coverUrl: null,
        coverBlob: new Blob(['cover'], { type: 'image/jpeg' }),
      },
    });
  });

  it('восстанавливает albums (с coverBlob)', async () => {
    const library = useLibraryStore();
    await library.restore();

    const albums = Object.values(library.albums);
    expect(albums.length).toBeGreaterThan(0);
    expect(albums[0]?.coverBlob).toBeInstanceOf(Blob);
  });
});
