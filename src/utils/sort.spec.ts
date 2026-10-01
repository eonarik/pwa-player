// src/utils/sort.spec.ts

import { describe, it, expect } from 'vitest'
import { compareStrings, sortBy, trackSortKey } from './sort'
import type { LibraryTrack } from '@/types/library'

function makeTrack(overrides: Partial<LibraryTrack>): LibraryTrack {
  return {
    id: 'id',
    pluginId: 'local',
    folderId: 'folder',
    title: 'title',
    artist: 'artist',
    album: 'album',
    filename: 'file.mp3',
    ...overrides,
  } as LibraryTrack
}

describe('compareStrings', () => {
  it('сортирует латиницу', () => {
    expect(compareStrings('apple', 'banana')).toBeLessThan(0)
    expect(compareStrings('banana', 'apple')).toBeGreaterThan(0)
    expect(compareStrings('apple', 'apple')).toBe(0)
  })

  it('сортирует кириллицу', () => {
    expect(compareStrings('абрикос', 'банан')).toBeLessThan(0)
  })

  it('учитывает числа как числа (numeric)', () => {
    expect(compareStrings('track2', 'track10')).toBeLessThan(0)
  })

  it('игнорирует регистр (sensitivity: base)', () => {
    expect(compareStrings('Apple', 'apple')).toBe(0)
  })
})

describe('sortBy', () => {
  it('сортирует по ключу', () => {
    const items = [{ name: 'banana' }, { name: 'apple' }, { name: 'cherry' }]
    const sorted = sortBy(items, (i) => i.name)
    expect(sorted.map((i) => i.name)).toEqual(['apple', 'banana', 'cherry'])
  })

  it('не мутирует оригинал', () => {
    const items = [{ name: 'b' }, { name: 'a' }]
    sortBy(items, (i) => i.name)
    expect(items.map((i) => i.name)).toEqual(['b', 'a'])
  })
})

describe('trackSortKey', () => {
  it('использует trackNumber с leading zeros', () => {
    const track = makeTrack({ trackNumber: 5, title: 'Song' })
    expect(trackSortKey(track)).toBe('005 Song')
  })

  it('обрабатывает двузначные номера', () => {
    const track = makeTrack({ trackNumber: 12, title: 'Song' })
    expect(trackSortKey(track)).toBe('012 Song')
  })

  it('без trackNumber — по title', () => {
    const track = makeTrack({ title: 'Song' })
    expect(trackSortKey(track)).toBe('Song')
  })
})
