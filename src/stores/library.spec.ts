import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibraryStore } from './library'
import { ROOT_FOLDER_ID, folderIdFromPath } from '@/services/library/id'
import type { Folder, LibraryTrack } from '@/types/library'
import type { PersistedLibrary } from '@/services/persistence/libraryTypes'

// vi.hoisted — потому что vi.mock хойстится наверх файла

const { mockLibraryPersistenceService, mockFileSystemService } = vi.hoisted(() => ({
  mockLibraryPersistenceService: {
    save: vi.fn<(lib: PersistedLibrary) => Promise<void>>(() => Promise.resolve()),
    load: vi.fn<() => Promise<PersistedLibrary | null>>(() => Promise.resolve(null)),
    clear: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  },
  mockFileSystemService: {
    findCoverInDirectory: vi.fn(() => Promise.resolve(null)),
    verifyPermission: vi.fn(() => Promise.resolve(true)),
  },
}))

vi.mock('@/services/persistence/LibraryPersistenceService', () => ({
  libraryPersistenceService: mockLibraryPersistenceService,
}))

vi.mock('@/services/filesystem/FileSystemService', () => ({
  fileSystemService: mockFileSystemService,
}))

// --- Вспомогательные фабрики ------------------------------------------

function makeFolder(overrides: Partial<Folder> & { id: string }): Folder {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    parentId: overrides.parentId ?? null,
    path: overrides.path ?? '',
    handle: {} as FileSystemDirectoryHandle,
    childFolderIds: overrides.childFolderIds ?? [],
    trackIds: overrides.trackIds ?? [],
    totalTrackCount: overrides.totalTrackCount ?? 0,
  }
}

function makeTrack(id: string, folderId: string): LibraryTrack {
  return {
    id,
    folderId,
    filename: `${id}.mp3`,
    path: `folder/${id}.mp3`,
    handle: {} as FileSystemFileHandle,
    source: new File([''], `${id}.mp3`),
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
  }
}

describe('useLibraryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLibraryPersistenceService.load.mockResolvedValue(null)
  })

  describe('пустое состояние', () => {
    it('hasLibrary = false', () => {
      const store = useLibraryStore()
      expect(store.hasLibrary).toBe(false)
    })

    it('currentFolder = null', () => {
      const store = useLibraryStore()
      expect(store.currentFolder).toBe(null)
    })

    it('breadcrumbs = []', () => {
      const store = useLibraryStore()
      expect(store.breadcrumbs).toEqual([])
    })

    it('canGoUp = false', () => {
      const store = useLibraryStore()
      expect(store.canGoUp).toBe(false)
    })
  })

  describe('setCurrentFolder', () => {
    it('устанавливает currentFolderId, если папка существует', () => {
      const store = useLibraryStore()
      const folder = makeFolder({ id: 'folder:Rock', path: 'Rock' })
      store.folders[folder.id] = folder
      store.rootFolderId = ROOT_FOLDER_ID

      store.setCurrentFolder('folder:Rock')

      expect(store.currentFolderId).toBe('folder:Rock')
      expect(store.currentFolder?.id).toBe('folder:Rock')
    })

    it('игнорирует несуществующую папку', () => {
      const store = useLibraryStore()
      store.rootFolderId = ROOT_FOLDER_ID

      store.setCurrentFolder('folder:NonExistent')

      expect(store.currentFolderId).toBe(null)
    })
  })

  describe('breadcrumbs', () => {
    it('строит цепочку от корня до текущей папки', () => {
      const store = useLibraryStore()

      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        name: 'Music',
        parentId: null,
        path: '',
      })
      const rock = makeFolder({
        id: folderIdFromPath('Rock'),
        name: 'Rock',
        parentId: root.id,
        path: 'Rock',
      })
      const album = makeFolder({
        id: folderIdFromPath('Rock/Album'),
        name: 'Album',
        parentId: rock.id,
        path: 'Rock/Album',
      })

      store.folders[root.id] = root
      store.folders[rock.id] = rock
      store.folders[album.id] = album
      store.rootFolderId = root.id
      store.currentFolderId = album.id

      const crumbs = store.breadcrumbs
      expect(crumbs.length).toBe(3)
      expect(crumbs[0]!.id).toBe(root.id)
      expect(crumbs[1]!.id).toBe(rock.id)
      expect(crumbs[2]!.id).toBe(album.id)
    })
  })

  describe('canGoUp', () => {
    it('true, если у текущей папки есть родитель', () => {
      const store = useLibraryStore()
      const root = makeFolder({ id: ROOT_FOLDER_ID, parentId: null })
      const sub = makeFolder({
        id: folderIdFromPath('Sub'),
        parentId: root.id,
        path: 'Sub',
      })
      store.folders[root.id] = root
      store.folders[sub.id] = sub
      store.currentFolderId = sub.id

      expect(store.canGoUp).toBe(true)
    })

    it('false, если текущая папка — корень', () => {
      const store = useLibraryStore()
      const root = makeFolder({ id: ROOT_FOLDER_ID, parentId: null })
      store.folders[root.id] = root
      store.currentFolderId = root.id

      expect(store.canGoUp).toBe(false)
    })
  })

  describe('currentSubfolders', () => {
    it('возвращает подпапки в порядке childFolderIds', () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        childFolderIds: ['folder:A', 'folder:B'],
      })
      const a = makeFolder({ id: 'folder:A' })
      const b = makeFolder({ id: 'folder:B' })

      store.folders[root.id] = root
      store.folders[a.id] = a
      store.folders[b.id] = b
      store.currentFolderId = root.id

      const subs = store.currentSubfolders
      expect(subs.map((f) => f.id)).toEqual(['folder:A', 'folder:B'])
    })

    it('фильтрует несуществующие id', () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        childFolderIds: ['folder:A', 'folder:Missing'],
      })
      const a = makeFolder({ id: 'folder:A' })

      store.folders[root.id] = root
      store.folders[a.id] = a
      store.currentFolderId = root.id

      const subs = store.currentSubfolders
      expect(subs.length).toBe(1)
      expect(subs[0]!.id).toBe('folder:A')
    })
  })

  describe('currentTracks', () => {
    it('возвращает треки в порядке trackIds', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:1', 'track:2'],
      })
      const t1 = makeTrack('track:1', folder.id)
      const t2 = makeTrack('track:2', folder.id)

      store.folders[folder.id] = folder
      store.tracks[t1.id] = t1
      store.tracks[t2.id] = t2
      store.currentFolderId = folder.id

      const tracks = store.currentTracks
      expect(tracks.map((t) => t.id)).toEqual(['track:1', 'track:2'])
    })
  })

  describe('clear', () => {
    it('обнуляет всё состояние', () => {
      const store = useLibraryStore()
      store.folders['folder:A'] = makeFolder({ id: 'folder:A' })
      store.tracks['track:1'] = makeTrack('track:1', 'folder:A')
      store.rootFolderId = 'folder:A'
      store.rootFolderName = 'Root'
      store.currentFolderId = 'folder:A'

      store.clear()

      expect(store.folders).toEqual({})
      expect(store.tracks).toEqual({})
      expect(store.rootFolderId).toBe(null)
      expect(store.rootFolderName).toBe(null)
      expect(store.currentFolderId).toBe(null)
      expect(mockLibraryPersistenceService.clear).toHaveBeenCalled()
    })
  })

  describe('restore', () => {
    it('возвращает false, если в IDB нет данных', async () => {
      const store = useLibraryStore()
      mockLibraryPersistenceService.load.mockResolvedValue(null)

      const result = await store.restore()

      expect(result).toBe(false)
      expect(store.hasLibrary).toBe(false)
    })

    it('возвращает false, если массив папок пуст', async () => {
      const store = useLibraryStore()
      mockLibraryPersistenceService.load.mockResolvedValue({
        folders: [],
        tracks: [],
        rootFolderId: '',
        rootFolderName: '',
        savedAt: 0,
      })

      const result = await store.restore()
      expect(result).toBe(false)
    })

    it('восстанавливает папки и треки', async () => {
      const store = useLibraryStore()
      const fakeHandle = {
        getFile: vi.fn(() => Promise.resolve(new File([''], 'a.mp3'))),
      } as unknown as FileSystemFileHandle

      mockLibraryPersistenceService.load.mockResolvedValue({
        folders: [
          {
            id: ROOT_FOLDER_ID,
            name: 'Music',
            parentId: null,
            path: '',
            handle: {} as FileSystemDirectoryHandle,
            childFolderIds: [],
            trackIds: ['track:1'],
            totalTrackCount: 1,
          },
        ],
        tracks: [
          {
            id: 'track:1',
            folderId: ROOT_FOLDER_ID,
            title: 'Song',
            artist: 'Artist',
            album: 'Album',
            filename: 'a.mp3',
            path: 'a.mp3',
            handle: fakeHandle,
          },
        ],
        rootFolderId: ROOT_FOLDER_ID,
        rootFolderName: 'Music',
        savedAt: Date.now(),
      })

      const result = await store.restore()

      expect(result).toBe(true)
      expect(store.hasLibrary).toBe(true)
      expect(store.rootFolderName).toBe('Music')
      expect(store.tracks['track:1']?.title).toBe('Song')
      expect(store.tracks['track:1']?.source).toBeInstanceOf(File)
    })
  })
})
