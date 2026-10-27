// src/stores/player/playerHelpers.spec.ts

import { describe, it, expect } from 'vitest'
import { shuffleArray, findFirstPlayableIndex, findPlayableIndex } from './playerHelpers'
import type { Track } from '@/types/track'

function makeTrack(id: string): Track {
  return {
    id,
    pluginId: 'local',
    title: id,
    artist: '',
    album: '',
    filename: '',
    sources: [{ id, pluginId: 'local', url: 'file://', priority: 10 }],
  } as Track
}

describe('shuffleArray', () => {
  it('возвращает массив той же длины с теми же элементами', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect(result).toHaveLength(input.length)
    expect([...result].sort()).toEqual([...input].sort())
  })

  it('не мутирует исходный массив', () => {
    const input = [1, 2, 3]
    const copy = [...input]
    shuffleArray(input)
    expect(input).toEqual(copy)
  })

  it('пустой массив → пустой', () => {
    expect(shuffleArray([])).toEqual([])
  })
})

describe('findFirstPlayableIndex', () => {
  const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

  const skipIds = (ids: string[]) => {
    const set = new Set(ids)
    return (t: Track) => set.has(t.id)
  }

  it('возвращает from, если он не должен быть пропущен', () => {
    expect(findFirstPlayableIndex(tracks, 0, skipIds([]))).toBe(0)
  })

  it('пропускает треки, попавшие в shouldSkip', () => {
    expect(findFirstPlayableIndex(tracks, 0, skipIds(['a']))).toBe(1)
  })

  it('возвращает -1, если все пропущены', () => {
    expect(findFirstPlayableIndex(tracks, 0, skipIds(['a', 'b', 'c']))).toBe(-1)
  })

  it('возвращает -1, если from за пределами', () => {
    expect(findFirstPlayableIndex(tracks, 5, skipIds([]))).toBe(-1)
  })
})

describe('findPlayableIndex', () => {
  const queue = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

  const skipIds = (ids: string[]) => {
    const set = new Set(ids)
    return (t: Track) => set.has(t.id)
  }

  it('вперёд: возвращает from, если не пропущен', () => {
    expect(findPlayableIndex(queue, 1, 1, skipIds([]))).toBe(1)
  })

  it('вперёд: пропускает', () => {
    expect(findPlayableIndex(queue, 0, 1, skipIds(['a', 'b']))).toBe(2)
  })

  it('вперёд: -1, если всё пропущено', () => {
    expect(findPlayableIndex(queue, 0, 1, skipIds(['a', 'b', 'c']))).toBe(-1)
  })

  it('назад: пропускает', () => {
    expect(findPlayableIndex(queue, 2, -1, skipIds(['c']))).toBe(1)
  })

  it('назад: -1, если всё пропущено', () => {
    expect(findPlayableIndex(queue, 2, -1, skipIds(['a', 'b', 'c']))).toBe(-1)
  })

  it('назад: -1, если from < 0', () => {
    expect(findPlayableIndex(queue, -1, -1, skipIds([]))).toBe(-1)
  })
})
