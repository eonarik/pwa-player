// server/src/metadata/similarity.spec.js

import { describe, it, expect } from 'vitest'
import { metadataSimilarity, NO_ARTIST_THRESHOLD } from './similarity.js'

describe('metadataSimilarity', () => {
  it('идентичные метаданные → 1', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Radiohead', title: 'Karma Police' },
    )
    expect(s).toBe(1)
  })

  it('разный порядок слов в title → 1', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Radiohead', title: 'Police Karma' },
    )
    expect(s).toBe(1)
  })

  it('транслит: «слот» ↔ «slot» (без artist)', () => {
    const s = metadataSimilarity({ artist: '', title: 'слот' }, { artist: '', title: 'slot' })
    expect(s).toBe(1)
  })

  it('транслит: Ночные снайперы ↔ Nochnye Snaypery', () => {
    const s = metadataSimilarity(
      { artist: 'Ночные снайперы', title: '31-я весна' },
      { artist: 'Nochnye Snaypery', title: '31-ya vesna' },
    )
    expect(s).toBeGreaterThan(0.85)
  })

  it('опечатка в title → > 0.85', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Radiohead', title: 'Karma Polise' },
    )
    expect(s).toBeGreaterThan(0.85)
  })

  it('один artist, разные треки → < 0.4', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Radiohead', title: 'Creep' },
    )
    expect(s).toBeLessThan(0.4)
  })

  it('разные исполнители одного языка → < 0.4', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Portishead', title: 'Glory Box' },
    )
    expect(s).toBeLessThan(0.4)
  })

  it('разные языки → 0', () => {
    const s = metadataSimilarity(
      { artist: 'Radiohead', title: 'Karma Police' },
      { artist: 'Иван Кучин', title: 'Царский романс' },
    )
    expect(s).toBe(0)
  })

  it('без общих токенов → 0', () => {
    const s = metadataSimilarity({ artist: 'AAA', title: 'BBB' }, { artist: 'XXX', title: 'YYY' })
    expect(s).toBe(0)
  })

  it('оба трека без title → 1', () => {
    const s = metadataSimilarity({ artist: 'A', title: '' }, { artist: 'B', title: '' })
    expect(s).toBe(1)
  })

  it('у original нет artist — учитывается только title', () => {
    const s = metadataSimilarity(
      { artist: '', title: 'Karma Police' },
      { artist: 'Radiohead', title: 'Karma Police' },
    )
    expect(s).toBe(1)
  })

  it('нормализует whitespace и регистр', () => {
    const s = metadataSimilarity(
      { artist: '  RADIOHEAD  ', title: '  Karma   Police  ' },
      { artist: 'radiohead', title: 'karma police' },
    )
    expect(s).toBe(1)
  })

  it('возвращает число в диапазоне [0, 1]', () => {
    const cases = [
      [
        { artist: 'A', title: 'B' },
        { artist: 'C', title: 'D' },
      ],
      [
        { artist: '', title: 'x' },
        { artist: 'y', title: 'z' },
      ],
      [
        { artist: 'a', title: 'b' },
        { artist: '', title: '' },
      ],
      [
        { artist: 'a', title: 'b' },
        { artist: '', title: 'b' },
      ],
    ]
    for (const [orig, inc] of cases) {
      const s = metadataSimilarity(orig, inc)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('NO_ARTIST_THRESHOLD', () => {
  it('равен 0.85', () => {
    expect(NO_ARTIST_THRESHOLD).toBe(0.85)
  })
})
