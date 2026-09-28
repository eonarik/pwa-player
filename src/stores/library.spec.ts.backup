// src/stores/library.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLibraryStore } from './library'
import { ROOT_FOLDER_ID, folderIdFromPath } from '@/services/library/id'
import type { Folder, LibraryTrack } from '@/types/library'
import type { PersistedLibrary } from '@/services/persistence/libraryTypes'

const {
  mockLibraryPersistenceService,
  mockYandexLibraryPersistenceService,
  mockFileSystemService,
  mockYandexDiskService,
  mockCoverPersistenceService,
} = vi.hoisted(() => ({
  mockLibraryPersistenceService: {
    save: vi.fn<(lib: PersistedLibrary) => Promise<void>>(() => Promise.resolve()),
    load: vi.fn<() => Promise<PersistedLibrary | null>>(() => Promise.resolve(null)),
    clear: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  },
  mockYandexLibraryPersistenceService: {
    save: vi.fn(() => Promise.resolve()),
    load: vi.fn<() => Promise<unknown>>(() => Promise.resolve(null)),
    clear: vi.fn(() => Promise.resolve()),
    isFresh: vi.fn(() => true),
  },
  mockFileSystemService: {
    findCoverInDirectory: vi.fn(() => Promise.resolve(null)),
    verifyPermission: vi.fn(() => Promise.resolve(true)),
  },
  mockYandexDiskService: {
    listResources: vi.fn(),
    buildDownloadUrl: vi.fn((p: string) => `https://proxy/api/disk/download?path=${p}`),
    getCover: vi.fn(() => Promise.resolve(null)),
  },
  mockCoverPersistenceService: {
    get: vi.fn<(id: string) => string | null | undefined>(() => undefined),
    setMany: vi.fn(() => Promise.resolve()),
    resetNotFound: vi.fn(() => Promise.resolve()),
    resetForTracks: vi.fn(() => Promise.resolve()),
    countChecked: vi.fn(() => 0),
    countFound: vi.fn(() => 0),
  },
}))

vi.mock('@/services/persistence/LibraryPersistenceService', () => ({
  libraryPersistenceService: mockLibraryPersistenceService,
}))

vi.mock('@/services/persistence/YandexLibraryPersistenceService', () => ({
  yandexLibraryPersistenceService: mockYandexLibraryPersistenceService,
}))

vi.mock('@/services/filesystem/FileSystemService', () => ({
  fileSystemService: mockFileSystemService,
}))

vi.mock('@/services/yandex/YandexDiskService', () => ({
  yandexDiskService: mockYandexDiskService,
}))

vi.mock('@/services/persistence/CoverPersistenceService', () => ({
  coverPersistenceService: mockCoverPersistenceService,
}))

vi.mock('@/services/persistence/lastSource', () => ({
  saveLastSource: vi.fn(() => Promise.resolve()),
  loadLastSource: vi.fn(() => Promise.resolve(null)),
}))

// --- Вспомогательные фабрики ------------------------------------------

function makeFolder(overrides: Partial<Folder> & { id: string }): Folder {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    parentId: overrides.parentId ?? null,
    path: overrides.path ?? '',
    handle: overrides.handle ?? ({} as FileSystemDirectoryHandle),
    childFolderIds: overrides.childFolderIds ?? [],
    trackIds: overrides.trackIds ?? [],
    totalTrackCount: overrides.totalTrackCount ?? 0,
    source: overrides.source,
    remotePath: overrides.remotePath,
  }
}

function makeTrack(
  id: string,
  folderId: string,
  overrides: Partial<LibraryTrack> = {},
): LibraryTrack {
  return {
    id,
    pluginId: overrides.pluginId ?? 'local',
    folderId,
    filename: `${id}.mp3`,
    path: `folder/${id}.mp3`,
    handle: {} as FileSystemFileHandle,
    source: new File([''], `${id}.mp3`),
    title: `Track ${id}`,
    artist: 'Artist',
    album: 'Album',
    ...overrides,
  }
}

function makeYandexItem(path: string, name: string, type: 'dir' | 'file') {
  return {
    path,
    name,
    type,
    isAudio: type === 'file',
  }
}

describe('useLibraryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockLibraryPersistenceService.load.mockResolvedValue(null)
    mockYandexLibraryPersistenceService.load.mockResolvedValue(null)
    mockYandexLibraryPersistenceService.isFresh.mockReturnValue(true)
    mockCoverPersistenceService.get.mockReturnValue(undefined)
  })

  // --- Пустое состояние -----------------------------------------------

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

    it('currentTracks = []', () => {
      const store = useLibraryStore()
      expect(store.currentTracks).toEqual([])
    })

    it('currentSubfolders = []', () => {
      const store = useLibraryStore()
      expect(store.currentSubfolders).toEqual([])
    })
  })

  // --- setCurrentFolder -----------------------------------------------

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

  // --- breadcrumbs ----------------------------------------------------

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

    it('останавливается, если parentId указывает в никуда', () => {
      const store = useLibraryStore()
      const orphan = makeFolder({
        id: 'folder:Orphan',
        parentId: 'folder:Missing',
        path: 'Orphan',
      })
      store.folders[orphan.id] = orphan
      store.currentFolderId = orphan.id

      const crumbs = store.breadcrumbs
      expect(crumbs.length).toBe(1)
      expect(crumbs[0]!.id).toBe(orphan.id)
    })
  })

  // --- canGoUp --------------------------------------------------------

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

  // --- currentSubfolders ----------------------------------------------

  describe('currentSubfolders', () => {
    it('возвращает подпапки, отсортированные по имени', () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        childFolderIds: ['folder:B', 'folder:A', 'folder:C'],
      })
      const a = makeFolder({ id: 'folder:A', name: 'Alpha' })
      const b = makeFolder({ id: 'folder:B', name: 'Beta' })
      const c = makeFolder({ id: 'folder:C', name: 'Gamma' })

      store.folders[root.id] = root
      store.folders[a.id] = a
      store.folders[b.id] = b
      store.folders[c.id] = c
      store.currentFolderId = root.id

      const subs = store.currentSubfolders
      expect(subs.map((f) => f.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('сортирует числа в именах как числа (2 < 10)', () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        childFolderIds: ['folder:10', 'folder:2', 'folder:1'],
      })
      const f1 = makeFolder({ id: 'folder:1', name: 'Трек 1' })
      const f2 = makeFolder({ id: 'folder:2', name: 'Трек 2' })
      const f10 = makeFolder({ id: 'folder:10', name: 'Трек 10' })

      store.folders[root.id] = root
      store.folders[f1.id] = f1
      store.folders[f2.id] = f2
      store.folders[f10.id] = f10
      store.currentFolderId = root.id

      const subs = store.currentSubfolders
      expect(subs.map((f) => f.name)).toEqual(['Трек 1', 'Трек 2', 'Трек 10'])
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

  // --- currentTracks --------------------------------------------------

  describe('currentTracks', () => {
    it('возвращает треки, отсортированные через trackSortKey', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:3', 'track:1', 'track:2'],
      })
      const t1 = makeTrack('track:1', folder.id, { trackNumber: 1, title: 'First' })
      const t2 = makeTrack('track:2', folder.id, { trackNumber: 2, title: 'Second' })
      const t3 = makeTrack('track:3', folder.id, { trackNumber: 3, title: 'Third' })

      store.folders[folder.id] = folder
      store.tracks[t1.id] = t1
      store.tracks[t2.id] = t2
      store.tracks[t3.id] = t3
      store.currentFolderId = folder.id

      const tracks = store.currentTracks
      expect(tracks.map((t) => t.trackNumber)).toEqual([1, 2, 3])
    })

    it('сортирует треки без trackNumber по title', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:b', 'track:a', 'track:c'],
      })
      const a = makeTrack('track:a', folder.id, { title: 'Alpha' })
      const b = makeTrack('track:b', folder.id, { title: 'Beta' })
      const c = makeTrack('track:c', folder.id, { title: 'Gamma' })

      store.folders[folder.id] = folder
      store.tracks[a.id] = a
      store.tracks[b.id] = b
      store.tracks[c.id] = c
      store.currentFolderId = folder.id

      expect(store.currentTracks.map((t) => t.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('фильтрует несуществующие id', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:a', 'track:missing'],
      })
      const a = makeTrack('track:a', folder.id)

      store.folders[folder.id] = folder
      store.tracks[a.id] = a
      store.currentFolderId = folder.id

      expect(store.currentTracks.length).toBe(1)
    })
  })

  // --- tracksWithoutCovers / coverStats -------------------------------

  describe('tracksWithoutCovers', () => {
    it('считает треки без coverUrl', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:a', 'track:b', 'track:c'],
      })
      store.folders[folder.id] = folder
      store.tracks['track:a'] = makeTrack('track:a', folder.id, { coverUrl: 'http://x' })
      store.tracks['track:b'] = makeTrack('track:b', folder.id)
      store.tracks['track:c'] = makeTrack('track:c', folder.id)
      store.currentFolderId = folder.id

      expect(store.tracksWithoutCovers).toBe(2)
    })
  })

  describe('coverStats', () => {
    it('различает «не искали» (undefined), «не нашли» (null) и «нашли» (URL)', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:a', 'track:b', 'track:c'],
      })
      store.folders[folder.id] = folder
      store.tracks['track:a'] = makeTrack('track:a', folder.id)
      store.tracks['track:b'] = makeTrack('track:b', folder.id)
      store.tracks['track:c'] = makeTrack('track:c', folder.id)
      store.currentFolderId = folder.id

      mockCoverPersistenceService.get.mockImplementation((id: string) => {
        if (id === 'track:a') return 'http://cover'
        if (id === 'track:b') return null
        return undefined
      })

      const stats = store.coverStats
      expect(stats.checked).toBe(2)
      expect(stats.found).toBe(1)
      expect(stats.total).toBe(2)
    })
  })

  // --- getAllTracksInFolderRecursive ----------------------------------

  describe('getAllTracksInFolderRecursive', () => {
    it('собирает треки рекурсивно: сначала свои, потом из подпапок', () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:r1'],
        childFolderIds: ['folder:A', 'folder:B'],
      })
      const a = makeFolder({
        id: 'folder:A',
        parentId: root.id,
        trackIds: ['track:a1'],
        childFolderIds: ['folder:A1'],
      })
      const a1 = makeFolder({
        id: 'folder:A1',
        parentId: a.id,
        trackIds: ['track:a1a'],
        childFolderIds: [],
      })
      const b = makeFolder({
        id: 'folder:B',
        parentId: root.id,
        trackIds: ['track:b1'],
        childFolderIds: [],
      })

      store.folders[root.id] = root
      store.folders[a.id] = a
      store.folders[a1.id] = a1
      store.folders[b.id] = b
      store.tracks['track:r1'] = makeTrack('track:r1', root.id)
      store.tracks['track:a1'] = makeTrack('track:a1', a.id)
      store.tracks['track:a1a'] = makeTrack('track:a1a', a1.id)
      store.tracks['track:b1'] = makeTrack('track:b1', b.id)

      const result = store.getAllTracksInFolderRecursive(root.id)
      expect(result.map((t) => t.id)).toEqual(['track:r1', 'track:a1', 'track:a1a', 'track:b1'])
    })

    it('возвращает [] для несуществующей папки', () => {
      const store = useLibraryStore()
      expect(store.getAllTracksInFolderRecursive('folder:Missing')).toEqual([])
    })

    it('пропускает треки, которых нет в tracks', () => {
      const store = useLibraryStore()
      const folder = makeFolder({
        id: ROOT_FOLDER_ID,
        trackIds: ['track:a', 'track:missing'],
      })
      store.folders[folder.id] = folder
      store.tracks['track:a'] = makeTrack('track:a', folder.id)

      expect(store.getAllTracksInFolderRecursive(folder.id).length).toBe(1)
    })
  })

  // --- clear ----------------------------------------------------------

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

    it('ревокает blob URL обложек перед очисткой', () => {
      const store = useLibraryStore()
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      store.tracks['track:a'] = makeTrack('track:a', 'folder:A', { coverUrl: 'blob:xxx' })
      store.tracks['track:b'] = makeTrack('track:b', 'folder:A', { coverUrl: 'https://remote' })

      store.clear()

      expect(revokeSpy).toHaveBeenCalledWith('blob:xxx')
      expect(revokeSpy).not.toHaveBeenCalledWith('https://remote')
      revokeSpy.mockRestore()
    })
  })

  // --- restore --------------------------------------------------------

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
            pluginId: 'local',
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
      expect(store.tracks['track:1']?.pluginId).toBe('local')
      expect(store.tracks['track:1']?.source).toBeInstanceOf(File)
    })

    it('удаляет failedTrackIds из folder.trackIds', async () => {
      const store = useLibraryStore()
      const badHandle = {
        getFile: vi.fn(() => Promise.reject(new Error('lost'))),
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
            trackIds: ['track:good', 'track:bad'],
            totalTrackCount: 2,
          },
        ],
        tracks: [
          {
            id: 'track:good',
            pluginId: 'local',
            folderId: ROOT_FOLDER_ID,
            title: 'Good',
            artist: 'A',
            album: 'B',
            filename: 'good.mp3',
            path: 'good.mp3',
            handle: {
              getFile: vi.fn(() => Promise.resolve(new File([''], 'good.mp3'))),
            } as unknown as FileSystemFileHandle,
          },
          {
            id: 'track:bad',
            pluginId: 'local',
            folderId: ROOT_FOLDER_ID,
            title: 'Bad',
            artist: 'A',
            album: 'B',
            filename: 'bad.mp3',
            path: 'bad.mp3',
            handle: badHandle,
          },
        ],
        rootFolderId: ROOT_FOLDER_ID,
        rootFolderName: 'Music',
        savedAt: Date.now(),
      })

      const result = await store.restore()

      expect(result).toBe(true)
      expect(store.folders[ROOT_FOLDER_ID]?.trackIds).toEqual(['track:good'])
    })

    it('ставит needsPermission = true, если все треки упали', async () => {
      const store = useLibraryStore()
      const badHandle = {
        getFile: vi.fn(() => Promise.reject(new Error('lost'))),
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
            trackIds: ['track:a'],
            totalTrackCount: 1,
          },
        ],
        tracks: [
          {
            id: 'track:a',
            pluginId: 'local',
            folderId: ROOT_FOLDER_ID,
            title: 'A',
            artist: 'A',
            album: 'B',
            filename: 'a.mp3',
            path: 'a.mp3',
            handle: badHandle,
          },
        ],
        rootFolderId: ROOT_FOLDER_ID,
        rootFolderName: 'Music',
        savedAt: Date.now(),
      })

      const result = await store.restore()

      expect(result).toBe(false)
      expect(store.needsPermission).toBe(true)
    })
  })

  // --- refreshCurrentYandexFolderRecursive ----------------------------

  describe('refreshCurrentYandexFolderRecursive', () => {
    it('пересчитывает totalTrackCount снизу вверх', async () => {
      const store = useLibraryStore()

      const root = makeFolder({
        id: 'folder:yandex:disk:/Music',
        name: 'Music',
        path: '',
        remotePath: 'disk:/Music',
        source: 'yandex',
        childFolderIds: ['folder:yandex:disk:/Music/A'],
        trackIds: [],
        totalTrackCount: 0,
      })
      const a = makeFolder({
        id: 'folder:yandex:disk:/Music/A',
        name: 'A',
        parentId: root.id,
        path: 'A',
        remotePath: 'disk:/Music/A',
        source: 'yandex',
        childFolderIds: ['folder:yandex:disk:/Music/A/A1'],
        trackIds: [],
        totalTrackCount: 0,
      })
      const a1 = makeFolder({
        id: 'folder:yandex:disk:/Music/A/A1',
        name: 'A1',
        parentId: a.id,
        path: 'A/A1',
        remotePath: 'disk:/Music/A/A1',
        source: 'yandex',
        childFolderIds: [],
        trackIds: [],
        totalTrackCount: 0,
      })

      store.folders[root.id] = root
      store.folders[a.id] = a
      store.folders[a1.id] = a1
      store.rootFolderId = root.id
      store.currentFolderId = root.id
      store.source = 'yandex'

      mockYandexDiskService.listResources.mockImplementation((path: string) => {
        if (path === 'disk:/Music') {
          return Promise.resolve({
            path,
            total: 1,
            items: [makeYandexItem('disk:/Music/A', 'A', 'dir')],
          })
        }
        if (path === 'disk:/Music/A') {
          return Promise.resolve({
            path,
            total: 1,
            items: [makeYandexItem('disk:/Music/A/A1', 'A1', 'dir')],
          })
        }
        if (path === 'disk:/Music/A/A1') {
          return Promise.resolve({
            path,
            total: 3,
            items: [
              makeYandexItem('disk:/Music/A/A1/01.mp3', '01.mp3', 'file'),
              makeYandexItem('disk:/Music/A/A1/02.mp3', '02.mp3', 'file'),
              makeYandexItem('disk:/Music/A/A1/03.mp3', '03.mp3', 'file'),
            ],
          })
        }
        return Promise.resolve({ path, total: 0, items: [] })
      })

      await store.refreshCurrentYandexFolderRecursive()

      expect(store.folders[a1.id]?.totalTrackCount).toBe(3)
      expect(store.folders[a.id]?.totalTrackCount).toBe(3)
      expect(store.folders[root.id]?.totalTrackCount).toBe(3)
    })

    it('учитывает собственные треки папки в totalTrackCount', async () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: 'folder:yandex:disk:/Music',
        name: 'Music',
        path: '',
        remotePath: 'disk:/Music',
        source: 'yandex',
        childFolderIds: ['folder:yandex:disk:/Music/A'],
        trackIds: [],
        totalTrackCount: 0,
      })
      const a = makeFolder({
        id: 'folder:yandex:disk:/Music/A',
        name: 'A',
        parentId: root.id,
        path: 'A',
        remotePath: 'disk:/Music/A',
        source: 'yandex',
        childFolderIds: [],
        trackIds: [],
        totalTrackCount: 0,
      })
      store.folders[root.id] = root
      store.folders[a.id] = a
      store.rootFolderId = root.id
      store.currentFolderId = root.id
      store.source = 'yandex'

      mockYandexDiskService.listResources.mockImplementation((path: string) => {
        if (path === 'disk:/Music') {
          return Promise.resolve({
            path,
            total: 2,
            items: [
              makeYandexItem('disk:/Music/root1.mp3', 'root1.mp3', 'file'),
              makeYandexItem('disk:/Music/A', 'A', 'dir'),
            ],
          })
        }
        if (path === 'disk:/Music/A') {
          return Promise.resolve({
            path,
            total: 1,
            items: [makeYandexItem('disk:/Music/A/a1.mp3', 'a1.mp3', 'file')],
          })
        }
        return Promise.resolve({ path, total: 0, items: [] })
      })

      await store.refreshCurrentYandexFolderRecursive()

      expect(store.folders[root.id]?.totalTrackCount).toBe(2)
      expect(store.folders[a.id]?.totalTrackCount).toBe(1)
    })

    it('удаляет треки, которых больше нет на Диске', async () => {
      const store = useLibraryStore()
      const root = makeFolder({
        id: 'folder:yandex:disk:/Music',
        name: 'Music',
        path: '',
        remotePath: 'disk:/Music',
        source: 'yandex',
        childFolderIds: [],
        trackIds: ['track:yandex:disk:/Music/old.mp3'],
        totalTrackCount: 1,
      })
      store.folders[root.id] = root
      store.tracks['track:yandex:disk:/Music/old.mp3'] = makeTrack(
        'track:yandex:disk:/Music/old.mp3',
        root.id,
        { pluginId: 'yandex', remotePath: 'disk:/Music/old.mp3' },
      )
      store.rootFolderId = root.id
      store.currentFolderId = root.id
      store.source = 'yandex'

      mockYandexDiskService.listResources.mockResolvedValue({
        path: 'disk:/Music',
        total: 0,
        items: [],
      })

      await store.refreshCurrentYandexFolderRecursive()

      expect(store.tracks['track:yandex:disk:/Music/old.mp3']).toBeUndefined()
      expect(store.folders[root.id]?.trackIds).toEqual([])
      expect(store.folders[root.id]?.totalTrackCount).toBe(0)
    })

    it('ничего не делает, если source !== yandex', async () => {
      const store = useLibraryStore()
      store.source = 'local'

      await store.refreshCurrentYandexFolderRecursive()

      expect(mockYandexDiskService.listResources).not.toHaveBeenCalled()
    })
  })

  // --- restoreYandexFromCache -----------------------------------------

  describe('restoreYandexFromCache', () => {
    it('возвращает false, если кэша нет', async () => {
      const store = useLibraryStore()
      mockYandexLibraryPersistenceService.load.mockResolvedValue(null)

      expect(await store.restoreYandexFromCache()).toBe(false)
    })

    it('возвращает false, если кэш просрочен', async () => {
      const store = useLibraryStore()
      mockYandexLibraryPersistenceService.load.mockResolvedValue({
        folders: [],
        tracks: [],
        rootFolderId: '',
        rootFolderName: '',
        rootPath: '',
        savedAt: 0,
      })
      mockYandexLibraryPersistenceService.isFresh.mockReturnValue(false)

      expect(await store.restoreYandexFromCache()).toBe(false)
    })

    it('восстанавливает библиотеку из свежего кэша', async () => {
      const store = useLibraryStore()
      mockYandexLibraryPersistenceService.load.mockResolvedValue({
        folders: [
          {
            id: 'folder:yandex:disk:/Music',
            name: 'Music',
            parentId: null,
            path: '',
            remotePath: 'disk:/Music',
            childFolderIds: [],
            trackIds: ['track:yandex:disk:/Music/a.mp3'],
            totalTrackCount: 1,
          },
        ],
        tracks: [
          {
            id: 'track:yandex:disk:/Music/a.mp3',
            pluginId: 'yandex',
            folderId: 'folder:yandex:disk:/Music',
            filename: 'a.mp3',
            path: 'a.mp3',
            remotePath: 'disk:/Music/a.mp3',
            title: 'A',
            artist: 'Yandex Disk',
            album: 'Music',
          },
        ],
        rootFolderId: 'folder:yandex:disk:/Music',
        rootFolderName: 'Music',
        rootPath: 'disk:/Music',
        savedAt: Date.now(),
      })

      const result = await store.restoreYandexFromCache()

      expect(result).toBe(true)
      expect(store.source).toBe('yandex')
      expect(store.tracks['track:yandex:disk:/Music/a.mp3']?.title).toBe('A')
      expect(store.rootFolderName).toBe('Music')
    })
  })

  // --- getTrack / getFolder -------------------------------------------

  describe('getTrack / getFolder', () => {
    it('возвращает трек по id или null', () => {
      const store = useLibraryStore()
      store.tracks['track:a'] = makeTrack('track:a', 'folder:A')
      expect(store.getTrack('track:a')).not.toBe(null)
      expect(store.getTrack('track:missing')).toBe(null)
    })

    it('возвращает папку по id или null', () => {
      const store = useLibraryStore()
      store.folders['folder:A'] = makeFolder({ id: 'folder:A' })
      expect(store.getFolder('folder:A')).not.toBe(null)
      expect(store.getFolder('folder:missing')).toBe(null)
    })
  })
})
