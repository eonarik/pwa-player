// src/utils/artists.spec.ts

import { describe, it, expect } from 'vitest'
import { groupByAlbum, filterTracksByArtist, NO_ALBUM_LABEL, NO_ALBUM_SLUG } from './artists'
import type { LibraryTrack } from '@/types/library'

function makeTrack(overrides: Partial<LibraryTrack>): LibraryTrack {
  return {
    id: `id-${Math.random()}`,
    pluginId: 'local',
    folderId: 'folder',
    title: 'title',
    artist: 'artist',
    album: 'album',
    filename: 'file.mp3',
    ...overrides,
  } as LibraryTrack
}

describe('groupByAlbum', () => {
  it('группирует по album', () => {
    const tracks = [
      makeTrack({ album: 'A', title: 'A1' }),
      makeTrack({ album: 'B', title: 'B1' }),
      makeTrack({ album: 'A', title: 'A2' }),
    ]
    const groups = groupByAlbum(tracks)
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.album === 'A')?.tracks).toHaveLength(2)
    expect(groups.find((g) => g.album === 'B')?.tracks).toHaveLength(1)
  })

  it('пустой альбом → Без альбома', () => {
    const tracks = [makeTrack({ album: '' })]
    const groups = groupByAlbum(tracks)
    expect(groups[0]!.name).toBe(NO_ALBUM_LABEL)
    expect(groups[0]!.slug).toBe(NO_ALBUM_SLUG)
  })

  it('сортирует группы по имени, кроме "Без альбома" (в конце)', () => {
    const tracks = [makeTrack({ album: 'B' }), makeTrack({ album: '' }), makeTrack({ album: 'A' })]
    const groups = groupByAlbum(tracks)
    expect(groups.map((g) => g.album)).toEqual(['A', 'B', ''])
  })

  it('сортирует треки внутри группы по trackNumber', () => {
    const tracks = [
      makeTrack({ album: 'A', trackNumber: 3 }),
      makeTrack({ album: 'A', trackNumber: 1 }),
      makeTrack({ album: 'A', trackNumber: 2 }),
    ]
    const groups = groupByAlbum(tracks)
    expect(groups[0]!.tracks.map((t) => t.trackNumber)).toEqual([1, 2, 3])
  })

  it('находит обложку из первого трека с coverUrl', () => {
    const tracks = [makeTrack({ album: 'A' }), makeTrack({ album: 'A', coverUrl: 'https://cover' })]
    const groups = groupByAlbum(tracks)
    expect(groups[0]!.coverUrl).toBe('https://cover')
  })

  it('возвращает undefined, если нет обложек', () => {
    const tracks = [makeTrack({ album: 'A' })]
    const groups = groupByAlbum(tracks)
    expect(groups[0]!.coverUrl).toBeUndefined()
  })

  it('пустой массив → пустой результат', () => {
    expect(groupByAlbum([])).toEqual([])
  })
})

describe('filterTracksByArtist', () => {
  it('фильтрует по artist (регистронезависимо)', () => {
    const tracks = [
      makeTrack({ artist: 'Radiohead' }),
      makeTrack({ artist: 'Portishead' }),
      makeTrack({ artist: 'radiohead' }),
    ]
    const result = filterTracksByArtist(tracks, 'RADIOHEAD')
    expect(result).toHaveLength(2)
  })

  it('обрезает пробелы', () => {
    const tracks = [makeTrack({ artist: 'Radiohead' })]
    const result = filterTracksByArtist(tracks, '  Radiohead  ')
    expect(result).toHaveLength(1)
  })

  it('пустое имя → пустой результат', () => {
    const tracks = [makeTrack({ artist: 'Radiohead' })]
    expect(filterTracksByArtist(tracks, '')).toEqual([])
    expect(filterTracksByArtist(tracks, '   ')).toEqual([])
  })

  it('не находит при несовпадении', () => {
    const tracks = [makeTrack({ artist: 'Radiohead' })]
    expect(filterTracksByArtist(tracks, 'Portishead')).toEqual([])
  })

  it('игнорирует треки без artist', () => {
    const tracks = [makeTrack({ artist: '' }), makeTrack({ artist: 'Radiohead' })]
    const result = filterTracksByArtist(tracks, 'Radiohead')
    expect(result).toHaveLength(1)
  })
})
