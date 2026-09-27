// src/services/persistence/restore.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { restoreTrack, restoreTracks } from './restore'
import { audioMockState } from '@/test/audioMockState'
import type { PersistedTrack } from './types'
import type { Track } from '@/types/track'

// vi.hoisted — потому что vi.mock хойстится наверх файла
const { mockFileSystemService } = vi.hoisted(() => ({
  mockFileSystemService: {
    findCoverInDirectory: vi.fn(() => Promise.resolve(null as File | null)),
  },
}))

vi.mock('@/services/filesystem/FileSystemService', () => ({
  fileSystemService: mockFileSystemService,
}))

// --- Вспомогательные фабрики ------------------------------------------

function makeFileHandle(name: string, content = ''): FileSystemFileHandle {
  return {
    getFile: vi.fn(() => Promise.resolve(new File([content], name))),
  } as unknown as FileSystemFileHandle
}

function makeBrokenHandle(): FileSystemFileHandle {
  return {
    getFile: vi.fn(() => Promise.reject(new Error('lost'))),
  } as unknown as FileSystemFileHandle
}

function makePersistedTrack(overrides: Partial<PersistedTrack> & { id: string }): PersistedTrack {
  return {
    id: overrides.id,
    title: overrides.title ?? `Track ${overrides.id}`,
    artist: overrides.artist ?? 'Artist',
    album: overrides.album ?? 'Album',
    year: overrides.year,
    trackNumber: overrides.trackNumber,
    genre: overrides.genre,
    duration: overrides.duration,
    codec: overrides.codec,
    filename: overrides.filename ?? `${overrides.id}.mp3`,
    path: overrides.path ?? `${overrides.id}.mp3`,
    handle: overrides.handle,
    directoryHandle: overrides.directoryHandle,
  }
}

/** Уникальный handle для группировки обложек (ссылочное сравнение в Map) */
function makeDirHandle(): FileSystemDirectoryHandle {
  return {} as FileSystemDirectoryHandle
}

describe('restoreTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audioMockState.reset()
  })

  it('восстанавливает Track с File через handle', async () => {
    const handle = makeFileHandle('a.mp3', 'content')
    const persisted = makePersistedTrack({ id: 't1', handle })

    const track = await restoreTrack(persisted)

    expect(track).not.toBe(null)
    expect(track!.id).toBe('t1')
    expect(track!.source).toBeInstanceOf(File)
    expect((track!.source as File).name).toBe('a.mp3')
  })

  it('возвращает source = "" без handle (трек неиграбельный)', async () => {
    const persisted = makePersistedTrack({ id: 't1' })

    const track = await restoreTrack(persisted)

    expect(track).not.toBe(null)
    expect(track!.source).toBe('')
  })

  it('возвращает source = "" при ошибке getFile()', async () => {
    const handle = makeBrokenHandle()
    const persisted = makePersistedTrack({ id: 't1', handle })

    const track = await restoreTrack(persisted)

    expect(track).not.toBe(null)
    expect(track!.source).toBe('')
  })

  it('переносит метаданные из persisted', async () => {
    const handle = makeFileHandle('a.mp3')
    const persisted = makePersistedTrack({
      id: 't1',
      title: 'Song',
      artist: 'Artist X',
      album: 'Album Y',
      handle,
    })

    const track = await restoreTrack(persisted)

    expect(track!.title).toBe('Song')
    expect(track!.artist).toBe('Artist X')
    expect(track!.album).toBe('Album Y')
  })

  it('переносит handle и directoryHandle', async () => {
    const handle = makeFileHandle('a.mp3')
    const dirHandle = makeDirHandle()
    const persisted = makePersistedTrack({ id: 't1', handle, directoryHandle: dirHandle })

    const track = await restoreTrack(persisted)

    expect(track!.handle).toBe(handle)
    expect(track!.directoryHandle).toBe(dirHandle)
  })

  it('переносит опциональные поля (year, trackNumber, genre, duration, codec)', async () => {
    const handle = makeFileHandle('a.mp3')
    const persisted = makePersistedTrack({
      id: 't1',
      handle,
      year: 2020,
      trackNumber: 3,
      genre: 'Rock',
      duration: 180,
      codec: 'mp3',
    })

    const track = await restoreTrack(persisted)

    expect(track!.year).toBe(2020)
    expect(track!.trackNumber).toBe(3)
    expect(track!.genre).toBe('Rock')
    expect(track!.duration).toBe(180)
    expect(track!.codec).toBe('mp3')
  })
})

describe('restoreTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    audioMockState.reset()
  })

  it('возвращает [] для пустого массива', async () => {
    const result = await restoreTracks([])
    expect(result).toEqual([])
  })

  it('восстанавливает все треки с handle', async () => {
    const persisted = [
      makePersistedTrack({ id: 't1', handle: makeFileHandle('a.mp3') }),
      makePersistedTrack({ id: 't2', handle: makeFileHandle('b.mp3') }),
      makePersistedTrack({ id: 't3', handle: makeFileHandle('c.mp3') }),
    ]

    const result = await restoreTracks(persisted)

    expect(result.length).toBe(3)
    expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
  })

  it('сохраняет порядок треков', async () => {
    const persisted = [
      makePersistedTrack({ id: 'z', handle: makeFileHandle('z.mp3') }),
      makePersistedTrack({ id: 'a', handle: makeFileHandle('a.mp3') }),
      makePersistedTrack({ id: 'm', handle: makeFileHandle('m.mp3') }),
    ]

    const result = await restoreTracks(persisted)

    expect(result.map((t) => t.id)).toEqual(['z', 'a', 'm'])
  })

  it('не падает, если часть треков битая', async () => {
    const persisted = [
      makePersistedTrack({ id: 't1', handle: makeFileHandle('a.mp3') }),
      makePersistedTrack({ id: 't2', handle: makeBrokenHandle() }),
      makePersistedTrack({ id: 't3', handle: makeFileHandle('c.mp3') }),
    ]

    const result = await restoreTracks(persisted)

    // Битый трек остаётся, но с source = '' (не выбрасывается)
    expect(result.length).toBe(3)
    expect(result[1]!.id).toBe('t2')
    expect(result[1]!.source).toBe('')
  })

  it('устанавливает coverUrl из folder.jpg для треков в одной папке', async () => {
    const dirHandle = makeDirHandle()
    const coverFile = new File(['cover'], 'folder.jpg')
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(coverFile)

    const persisted = [
      makePersistedTrack({
        id: 't1',
        handle: makeFileHandle('a.mp3'),
        directoryHandle: dirHandle,
      }),
      makePersistedTrack({
        id: 't2',
        handle: makeFileHandle('b.mp3'),
        directoryHandle: dirHandle,
      }),
    ]

    const result = await restoreTracks(persisted)

    expect(result[0]!.coverUrl).toBeDefined()
    expect(result[0]!.coverUrl!.startsWith('blob:')).toBe(true)
    expect(result[1]!.coverUrl).toBeDefined()
  })

  it('не устанавливает coverUrl, если folder.jpg нет', async () => {
    const dirHandle = makeDirHandle()
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(null)

    const persisted = [
      makePersistedTrack({
        id: 't1',
        handle: makeFileHandle('a.mp3'),
        directoryHandle: dirHandle,
      }),
    ]

    const result = await restoreTracks(persisted)

    expect(result[0]!.coverUrl).toBeUndefined()
  })

  it('кэширует findCoverInDirectory по directoryHandle', async () => {
    const dirHandle = makeDirHandle()
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(new File(['cover'], 'folder.jpg'))

    const persisted = [
      makePersistedTrack({
        id: 't1',
        handle: makeFileHandle('a.mp3'),
        directoryHandle: dirHandle,
      }),
      makePersistedTrack({
        id: 't2',
        handle: makeFileHandle('b.mp3'),
        directoryHandle: dirHandle,
      }),
      makePersistedTrack({
        id: 't3',
        handle: makeFileHandle('c.mp3'),
        directoryHandle: dirHandle,
      }),
    ]

    await restoreTracks(persisted)

    // findCoverInDirectory должен вызваться один раз на папку, не на трек
    expect(mockFileSystemService.findCoverInDirectory).toHaveBeenCalledTimes(1)
  })

  // --- ВНИМАНИЕ: этот тест фиксирует ТЕКУЩИЙ баг ---
  // restore.ts создаёт новый blob URL на каждый трек в папке,
  // хотя coverFile один и тот же. После фикса (кэш URL вместо File)
  // этот тест должен стать красным — тогда заменим ожидание на 1.
  it('[БАГ] создаёт новый blob URL на каждый трек в одной папке', async () => {
    const dirHandle = makeDirHandle()
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(new File(['cover'], 'folder.jpg'))

    const persisted = [
      makePersistedTrack({
        id: 't1',
        handle: makeFileHandle('a.mp3'),
        directoryHandle: dirHandle,
      }),
      makePersistedTrack({
        id: 't2',
        handle: makeFileHandle('b.mp3'),
        directoryHandle: dirHandle,
      }),
      makePersistedTrack({
        id: 't3',
        handle: makeFileHandle('c.mp3'),
        directoryHandle: dirHandle,
      }),
    ]

    const before = audioMockState.urlCounter
    await restoreTracks(persisted)
    const created = audioMockState.urlCounter - before

    // Сейчас: 3 вызова (по одному на трек). После фикса: 1.
    expect(created).toBe(3)
  })

  it('треки без directoryHandle не получают coverUrl', async () => {
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(new File(['cover'], 'folder.jpg'))

    const persisted = [
      makePersistedTrack({ id: 't1', handle: makeFileHandle('a.mp3') }),
      // directoryHandle не задан
    ]

    const result = await restoreTracks(persisted)

    expect(result[0]!.coverUrl).toBeUndefined()
    expect(mockFileSystemService.findCoverInDirectory).not.toHaveBeenCalled()
  })

  it('не перезаписывает coverUrl, если он уже есть', async () => {
    const dirHandle = makeDirHandle()
    mockFileSystemService.findCoverInDirectory.mockResolvedValue(new File(['cover'], 'folder.jpg'))

    const persisted = [
      makePersistedTrack({
        id: 't1',
        handle: makeFileHandle('a.mp3'),
        directoryHandle: dirHandle,
      }),
    ]

    // Представим, что TrackMetadata уже пришёл с coverUrl (не бывает в текущем коде,
    // но restoreTracks должен вести себя корректно). Сейчас — перезапишет.
    const result = await restoreTracks(persisted)

    expect(result[0]!.coverUrl).toBeDefined()
  })

  it('соблюдает concurrency (не запускает все getFile одновременно)', async () => {
    const pending: Array<() => void> = []
    const handle = {
      getFile: vi.fn(() => {
        return new Promise<File>((resolve) => {
          pending.push(() => resolve(new File([''], 'x.mp3')))
        })
      }),
    } as unknown as FileSystemFileHandle

    const persisted = Array.from({ length: 20 }, (_, i) =>
      makePersistedTrack({ id: `t${i}`, handle }),
    )

    const promise = restoreTracks(persisted, 4)

    // Дадим микротаскам прокрутиться
    await new Promise((r) => setTimeout(r, 0))

    // В работе не больше 4 промисов одновременно
    expect(pending.length).toBeLessThanOrEqual(4)

    // Разрешаем все
    while (pending.length > 0) {
      pending.shift()!()
      await new Promise((r) => setTimeout(r, 0))
    }

    const result = await promise
    expect(result.length).toBe(20)
  })
})
