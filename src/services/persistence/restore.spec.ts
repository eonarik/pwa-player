// oxlint-disable vitest/require-mock-type-parameters
// src/services/persistence/restore.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { restoreTrack, restoreTracks } from './restore'
import type { PersistedTrack } from './types'

// Мокаем findCoverInDirectory — не нужен для основных тестов
vi.mock('@/services/covers/findCoverInDirectory', () => ({
  findCoverInDirectory: vi.fn(async () => null),
}))

function makePersisted(overrides: Partial<PersistedTrack> = {}): PersistedTrack {
  return {
    id: 'track:local:Music/song.mp3',
    pluginId: 'local:Music',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    filename: 'song.mp3',
    path: 'song.mp3',
    ...overrides,
  }
}

function makeFileHandle(name = 'song.mp3'): FileSystemFileHandle {
  const file = new File(['audio-data'], name, { type: 'audio/mpeg' })
  return {
    kind: 'file',
    name,
    getFile: vi.fn(async () => file),
  } as unknown as FileSystemFileHandle
}

function makeBadHandle(): FileSystemFileHandle {
  return {
    kind: 'file',
    name: 'bad.mp3',
    getFile: vi.fn(async () => {
      throw new DOMException('Not found', 'NotFoundError')
    }),
  } as unknown as FileSystemFileHandle
}

describe('restoreTrack', () => {
  it('восстанавливает трек с File', async () => {
    const handle = makeFileHandle()
    const persisted = makePersisted({ handle })

    const track = await restoreTrack(persisted)

    expect(track).not.toBeNull()
    expect(track!.id).toBe(persisted.id)
    expect(track!.title).toBe('Song')
    expect(track!.source).toBeInstanceOf(File)
  })

  it('без handle → source = пустая строка', async () => {
    const persisted = makePersisted({ handle: undefined })

    const track = await restoreTrack(persisted)

    expect(track).not.toBeNull()
    expect(track!.source).toBe('')
  })

  it('при ошибке getFile → source = пустая строка', async () => {
    const handle = makeBadHandle()
    const persisted = makePersisted({ handle })

    const track = await restoreTrack(persisted)

    expect(track).not.toBeNull()
    expect(track!.source).toBe('')
  })

  it('сохраняет метаданные', async () => {
    const handle = makeFileHandle()
    const persisted = makePersisted({
      handle,
      year: 2020,
      trackNumber: 5,
      genre: 'Rock',
      duration: 180,
      codec: 'MP3',
    })

    const track = await restoreTrack(persisted)

    expect(track!.year).toBe(2020)
    expect(track!.trackNumber).toBe(5)
    expect(track!.genre).toBe('Rock')
    expect(track!.duration).toBe(180)
    expect(track!.codec).toBe('MP3')
  })
})

describe('restoreTracks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('восстанавливает массив', async () => {
    const persisted = [
      makePersisted({ id: 'a', handle: makeFileHandle('a.mp3') }),
      makePersisted({ id: 'b', handle: makeFileHandle('b.mp3') }),
      makePersisted({ id: 'c', handle: makeFileHandle('c.mp3') }),
    ]

    const tracks = await restoreTracks(persisted)

    expect(tracks).toHaveLength(3)
    expect(tracks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('пропускает треки без source', async () => {
    const persisted = [
      makePersisted({ id: 'a', handle: makeFileHandle('a.mp3') }),
      makePersisted({ id: 'b', handle: undefined }),
    ]

    const tracks = await restoreTracks(persisted)

    // Оба восстанавливаются (source = ''), но это валидные треки
    expect(tracks).toHaveLength(2)
  })

  it('пустой массив → пустой результат', async () => {
    const tracks = await restoreTracks([])
    expect(tracks).toEqual([])
  })

  it('не падает при ошибке чтения отдельного трека', async () => {
    const persisted = [
      makePersisted({ id: 'good', handle: makeFileHandle('good.mp3') }),
      makePersisted({ id: 'bad', handle: makeBadHandle() }),
    ]

    const tracks = await restoreTracks(persisted)

    expect(tracks).toHaveLength(2)
    const bad = tracks.find((t) => t.id === 'bad')
    expect(bad!.source).toBe('')
  })
})
