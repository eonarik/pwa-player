// src/stores/player/playerHelpers.spec.ts

import { describe, it, expect } from 'vitest'
import { shuffleArray, findNonDislikedIndexFrom, findNonDislikedIndex } from './playerHelpers'
import type { Track } from '@/types/track'

function makeTrack(id: string): Track {
  return {
    id,
    pluginId: 'local',
    title: id,
    artist: '',
    album: '',
    filename: '',
    source: 'file://',
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

describe('findNonDislikedIndexFrom', () => {
  const tracks = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

  it('возвращает from, если он не дизлайкнут', () => {
    expect(findNonDislikedIndexFrom(tracks, 0, new Set())).toBe(0)
  })

  it('пропускает дизлайкнутые', () => {
    expect(findNonDislikedIndexFrom(tracks, 0, new Set(['a']))).toBe(1)
  })

  it('возвращает -1, если все дизлайкнуты', () => {
    expect(findNonDislikedIndexFrom(tracks, 0, new Set(['a', 'b', 'c']))).toBe(-1)
  })

  it('возвращает -1, если from за пределами', () => {
    expect(findNonDislikedIndexFrom(tracks, 5, new Set())).toBe(-1)
  })
})

describe('findNonDislikedIndex', () => {
  const queue = [makeTrack('a'), makeTrack('b'), makeTrack('c')]

  it('вперёд: возвращает from, если не дизлайкнут', () => {
    expect(findNonDislikedIndex(queue, 1, 1, new Set())).toBe(1)
  })

  it('вперёд: пропускает дизлайкнутые', () => {
    expect(findNonDislikedIndex(queue, 0, 1, new Set(['a', 'b']))).toBe(2)
  })

  it('вперёд: -1, если всё дизлайкнуто', () => {
    expect(findNonDislikedIndex(queue, 0, 1, new Set(['a', 'b', 'c']))).toBe(-1)
  })

  it('назад: пропускает дизлайкнутые', () => {
    expect(findNonDislikedIndex(queue, 2, -1, new Set(['c']))).toBe(1)
  })

  it('назад: -1, если всё дизлайкнуто', () => {
    expect(findNonDislikedIndex(queue, 2, -1, new Set(['a', 'b', 'c']))).toBe(-1)
  })

  it('назад: -1, если from < 0', () => {
    expect(findNonDislikedIndex(queue, -1, -1, new Set())).toBe(-1)
  })
})
