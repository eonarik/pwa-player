// src/utils/fuzzyMatch.spec.ts

import { describe, it, expect } from 'vitest'
import { fuzzyMatch } from './fuzzyMatch'

describe('fuzzyMatch', () => {
  it('идентичные строки → 1.0', () => {
    expect(fuzzyMatch('radiohead', 'radiohead')).toBe(1)
  })

  it('схожие строки → > 0.8', () => {
    expect(fuzzyMatch('karma police', 'karma police')).toBe(1)
    expect(fuzzyMatch('kolibelnaya', 'kolibelnaya')).toBe(1)
    expect(fuzzyMatch('слот', 'слот')).toBe(1)
  })

  it('близкие строки → > 0.8', () => {
    expect(fuzzyMatch('radiohead', 'radiohed')).toBeGreaterThan(0.9)
  })

  it('разные строки → < 0.5', () => {
    expect(fuzzyMatch('radiohead', 'monument')).toBeLessThan(0.5)
    expect(fuzzyMatch('слот', 'монотеизм')).toBeLessThan(0.7)
  })

  it('обрабатывает пустые строки', () => {
    expect(fuzzyMatch('', '')).toBe(1)
    expect(fuzzyMatch('abc', '')).toBe(0)
    expect(fuzzyMatch('', 'abc')).toBe(0)
  })

  it('чувствителен к регистру', () => {
    expect(fuzzyMatch('Radiohead', 'radiohead')).toBeLessThan(1)
    expect(fuzzyMatch('Radiohead', 'radiohead')).toBeGreaterThan(0.8)
  })

  it('учитывает общий префикс', () => {
    const withPrefix = fuzzyMatch('karma police', 'karma police')
    const withoutPrefix = fuzzyMatch('police karma', 'police karma')
    expect(withPrefix).toBe(1)
    expect(withoutPrefix).toBe(1)
  })

  it('порядок слов не важен', () => {
    const a = fuzzyMatch('radiohead karma', 'radiohead karma')
    const b = fuzzyMatch('radiohead karma', 'karma radiohead')
    expect(a).toBe(1)
    // b — ниже, потому что порядок влияет на Jaro
    expect(b).toBeLessThan(1)
  })
})
