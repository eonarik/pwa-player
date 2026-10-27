// src/services/library/selectors.spec.ts

import { describe, it, expect } from 'vitest'
import { getPlayability, isLocalTrack, isRemoteTrack, isSubtreeScanned } from './selectors'
import type { Folder, LibraryTrack } from '@/types/library'

function makeTrack(overrides: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 't',
    pluginId: 'yandex',
    folderId: 'f',
    title: 'T',
    artist: 'A',
    album: 'Al',
    filename: 't.mp3',
    source: '',
    ...overrides,
  } as LibraryTrack
}

const noDisconnected = { isPluginDisconnected: false, isDownloading: false }
const disconnected = { isPluginDisconnected: true, isDownloading: false }
const downloading = { isPluginDisconnected: false, isDownloading: true }

describe('getPlayability', () => {
  it('null → missing', () => {
    expect(getPlayability(null, noDisconnected)).toBe('missing')
  })

  it('nowhere → missing', () => {
    const t = makeTrack({ fileLocation: 'nowhere', sources: [] })
    expect(getPlayability(t, noDisconnected)).toBe('missing')
  })

  it('both без handle → unavailable (битое состояние)', () => {
    const t = makeTrack({ fileLocation: 'both', sources: [] })
    expect(getPlayability(t, noDisconnected)).toBe('unavailable')
  })

  it('remote-only, сессия жива → playable-streaming', () => {
    const t = makeTrack({
      fileLocation: 'remote-only',
      sources: [{ id: 't', pluginId: 'yandex', url: 'http://...', priority: 20 }],
    })
    expect(getPlayability(t, noDisconnected)).toBe('playable-streaming')
  })

  it('remote-only, сессия мертва → needs-reconnect', () => {
    const t = makeTrack({
      fileLocation: 'remote-only',
      sources: [{ id: 't', pluginId: 'yandex', url: 'http://...', priority: 20 }],
    })
    expect(getPlayability(t, disconnected)).toBe('needs-reconnect')
  })

  it('downloading перебивает всё', () => {
    const t = makeTrack({
      fileLocation: 'remote-only',
      sources: [{ id: 't', pluginId: 'yandex', url: 'http://...', priority: 20 }],
    })
    expect(getPlayability(t, downloading)).toBe('downloading')
  })

  it('undefined fileLocation → как remote-only', () => {
    const t = makeTrack({
      sources: [{ id: 't', pluginId: 'yandex', url: 'http://...', priority: 20 }],
    })
    expect(getPlayability(t, noDisconnected)).toBe('playable-streaming')
  })
})

describe('isLocalTrack', () => {
  it('both → true', () => {
    expect(isLocalTrack(makeTrack({ fileLocation: 'both' }))).toBe(true)
  })
  it('local-only → true', () => {
    expect(isLocalTrack(makeTrack({ fileLocation: 'local-only' }))).toBe(true)
  })
  it('remote-only → false', () => {
    expect(isLocalTrack(makeTrack({ fileLocation: 'remote-only' }))).toBe(false)
  })
  it('nowhere → false', () => {
    expect(isLocalTrack(makeTrack({ fileLocation: 'nowhere' }))).toBe(false)
  })
  it('null → false', () => {
    expect(isLocalTrack(null)).toBe(false)
  })
})

describe('isRemoteTrack', () => {
  it('both → true', () => {
    expect(isRemoteTrack(makeTrack({ fileLocation: 'both' }))).toBe(true)
  })
  it('local-only → false', () => {
    expect(isRemoteTrack(makeTrack({ fileLocation: 'local-only' }))).toBe(false)
  })
  it('remote-only → true', () => {
    expect(isRemoteTrack(makeTrack({ fileLocation: 'remote-only' }))).toBe(true)
  })
  it('nowhere → false', () => {
    expect(isRemoteTrack(makeTrack({ fileLocation: 'nowhere' }))).toBe(false)
  })
  it('null → false', () => {
    expect(isRemoteTrack(null)).toBe(false)
  })
})

describe('isSubtreeScanned', () => {
  function makeFolder(id: string, overrides: Partial<Folder> = {}): Folder {
    return {
      id,
      name: id,
      parentId: null,
      path: '',
      childFolderIds: [],
      trackIds: [],
      totalTrackCount: 0,
      ...overrides,
    }
  }

  function makeGetter(folders: Folder[]): (id: string) => Folder | null {
    const map = new Map(folders.map((f) => [f.id, f]))
    return (id) => map.get(id) ?? null
  }

  it('одна папка scanned → true', () => {
    const folders = [makeFolder('a', { scanState: 'scanned' })]
    expect(isSubtreeScanned('a', makeGetter(folders))).toBe(true)
  })

  it('одна папка pending → false', () => {
    const folders = [makeFolder('a', { scanState: 'pending' })]
    expect(isSubtreeScanned('a', makeGetter(folders))).toBe(false)
  })

  it('папка scanned, ребёнок pending → false', () => {
    const folders = [
      makeFolder('a', { scanState: 'scanned', childFolderIds: ['b'] }),
      makeFolder('b', { scanState: 'pending', parentId: 'a' }),
    ]
    expect(isSubtreeScanned('a', makeGetter(folders))).toBe(false)
  })

  it('папка и все дети scanned → true', () => {
    const folders = [
      makeFolder('a', { scanState: 'scanned', childFolderIds: ['b', 'c'] }),
      makeFolder('b', { scanState: 'scanned', parentId: 'a' }),
      makeFolder('c', { scanState: 'scanned', parentId: 'a' }),
    ]
    expect(isSubtreeScanned('a', makeGetter(folders))).toBe(true)
  })

  it('нет папки → true (нечего ждать)', () => {
    expect(isSubtreeScanned('missing', () => null)).toBe(true)
  })

  it('цикл защищён', () => {
    const folders = [
      makeFolder('a', { scanState: 'scanned', childFolderIds: ['b'] }),
      makeFolder('b', { scanState: 'scanned', parentId: 'a', childFolderIds: ['a'] }),
    ]
    expect(isSubtreeScanned('a', makeGetter(folders))).toBe(true)
  })
})
