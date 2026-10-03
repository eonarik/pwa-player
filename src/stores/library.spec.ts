// oxlint-disable vitest/require-mock-type-parameters
// src/stores/library.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibraryStore, createLibraryWriter } from './library'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'

vi.mock('@/services/library/LibrarySaveService', () => ({
  librarySaveService: {
    scheduleSave: vi.fn(),
    flush: vi.fn(async () => {}),
    flushAll: vi.fn(async () => {}),
  },
}))

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'folder:local:Music',
    name: 'Music',
    parentId: null,
    path: '',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: 'local:Music',
    ...overrides,
  } as Folder
}

function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 'track:local:Music/song.mp3',
    pluginId: 'local:Music',
    folderId: 'folder:local:Music',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: 'song.mp3',
    path: 'song.mp3',
    source: 'file://',
    ...overrides,
  } as LibraryTrack
}

function makeCollected(folders: Folder[], tracks: LibraryTrack[]): CollectedLibrary {
  return {
    folders,
    tracks,
    rootFolderId: folders[0]?.id ?? '',
    rootFolderName: folders[0]?.name ?? '',
  }
}

describe('createLibraryWriter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('matchesSource', () => {
    it('setLibrary заменяет только sourceId и его под-источники', () => {
      const library = useLibraryStore()
      const writer = createLibraryWriter()

      // Сначала положим local + local:Music + yandex
      writer.setLibrary(
        makeCollected(
          [
            makeFolder({ id: 'folder:local', source: 'local', parentId: null }),
            makeFolder({
              id: 'folder:local:Music',
              source: 'local:Music',
              parentId: 'folder:local',
            }),
          ],
          [],
        ),
        'local',
      )

      writer.setLibrary(
        makeCollected([makeFolder({ id: 'folder:yandex', source: 'yandex', parentId: null })], []),
        'yandex',
      )

      // Теперь меняем local:Music — должны удалиться ТОЛЬКО folder:local:Music, но не folder:local и не folder:yandex
      writer.setLibrary(
        makeCollected(
          [
            makeFolder({
              id: 'folder:local:Music-2',
              source: 'local:Music-2',
              parentId: 'folder:local',
            }),
          ],
          [],
        ),
        'local:Music',
      )

      expect(library.folders['folder:local']).toBeDefined()
      expect(library.folders['folder:yandex']).toBeDefined()
    })
  })

  describe('setLibrary', () => {
    it('добавляет папки и треки', () => {
      const writer = createLibraryWriter()
      const library = useLibraryStore()

      writer.setLibrary(makeCollected([makeFolder()], [makeTrack()]), 'local:Music')

      expect(Object.keys(library.folders)).toHaveLength(1)
      expect(Object.keys(library.tracks)).toHaveLength(1)
    })

    it('сохраняет source и pluginId как есть', () => {
      const writer = createLibraryWriter()
      const library = useLibraryStore()

      writer.setLibrary(makeCollected([makeFolder()], [makeTrack()]), 'local:Music')

      expect(library.folders['folder:local:Music']!.source).toBe('local:Music')
      expect(library.tracks['track:local:Music/song.mp3']!.pluginId).toBe('local:Music')
    })
  })

  describe('updateTrackMetadata', () => {
    it('обновляет artist/title/album/coverUrl', () => {
      const writer = createLibraryWriter()
      const library = useLibraryStore()

      writer.setLibrary(makeCollected([makeFolder()], [makeTrack()]), 'local:Music')

      writer.updateTrackMetadata('track:local:Music/song.mp3', {
        artist: 'New Artist',
        album: 'New Album',
        coverUrl: 'https://cover',
      })

      const track = library.tracks['track:local:Music/song.mp3']!
      expect(track.artist).toBe('New Artist')
      expect(track.album).toBe('New Album')
      expect(track.coverUrl).toBe('https://cover')
    })
  })

  describe('updateTrackOrigin', () => {
    it('обновляет origin', () => {
      const writer = createLibraryWriter()
      const library = useLibraryStore()

      writer.setLibrary(makeCollected([makeFolder()], [makeTrack()]), 'local:Music')
      writer.updateTrackOrigin('track:local:Music/song.mp3', 'downloaded')

      expect(library.tracks['track:local:Music/song.mp3']!.origin).toBe('downloaded')
    })
  })

  describe('getFoldersBySource', () => {
    it('возвращает папки с matching source', () => {
      const writer = createLibraryWriter()

      writer.setLibrary(
        makeCollected(
          [
            makeFolder({ id: 'a', source: 'local' }),
            makeFolder({ id: 'b', source: 'local:Music' }),
            makeFolder({ id: 'c', source: 'yandex' }),
          ],
          [],
        ),
        'local',
      )

      // getFoldersBySource возвращает всё с source === 'local' или 'local:*'
      const localFolders = writer.getFoldersBySource('local')
      expect(localFolders.map((f) => f.id)).toEqual(expect.arrayContaining(['a', 'b']))
      expect(localFolders.map((f) => f.id)).not.toContain('c')
    })
  })

  describe('removeBySource', () => {
    it('удаляет source + под-источники', () => {
      const writer = createLibraryWriter()
      const library = useLibraryStore()

      writer.setLibrary(
        makeCollected(
          [
            makeFolder({ id: 'a', source: 'local' }),
            makeFolder({ id: 'b', source: 'local:Music' }),
          ],
          [makeTrack({ pluginId: 'local:Music' })],
        ),
        'local',
      )

      writer.removeBySource('local')

      expect(Object.keys(library.folders)).toHaveLength(0)
      expect(Object.keys(library.tracks)).toHaveLength(0)
    })
  })

  it('recalc: удаление треков в двух сиблингах → корректный totalTrackCount у родителя', () => {
    const writer = createLibraryWriter()
    const library = useLibraryStore()

    writer.setLibrary(
      makeCollected(
        [
          makeFolder({ id: 'P', parentId: null, source: 'local' }),
          makeFolder({ id: 'A', parentId: 'P', source: 'local' }),
          makeFolder({ id: 'B', parentId: 'P', source: 'local' }),
        ],
        [
          makeTrack({ id: 't1', folderId: 'A' }),
          makeTrack({ id: 't2', folderId: 'A' }),
          makeTrack({ id: 't3', folderId: 'B' }),
        ],
      ),
      'local',
    )

    // вручную синхронизируем счётчики
    writer.updateFolder('P', { childFolderIds: ['A', 'B'] })
    writer.updateFolder('A', { trackIds: ['t1', 't2'] })
    writer.updateFolder('B', { trackIds: ['t3'] })
    expect(library.folders['P']!.totalTrackCount).toBe(3)

    writer.removeTracks(['t1', 't3'])

    expect(library.folders['A']!.totalTrackCount).toBe(1)
    expect(library.folders['B']!.totalTrackCount).toBe(0)
    expect(library.folders['P']!.totalTrackCount).toBe(1)
  })
})
