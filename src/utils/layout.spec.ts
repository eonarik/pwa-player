// src/utils/layout.spec.ts

import { describe, it, expect } from 'vitest'
import { toRussianLayout, toEnglishLayout, normalizeUmlauts, layoutVariants } from './layout'

describe('toRussianLayout', () => {
  it('конвертирует QWERTY в ЙЦУКЕН', () => {
    expect(toRussianLayout('rjks,tkmyfz')).toBe('колыбельная')
  })

  it('сохраняет незнакомые символы', () => {
    expect(toRussianLayout('abc123')).toBe('фис123')
  })

  it('работает с заглавными', () => {
    expect(toRussianLayout('RJK')).toBe('КОЛ')
  })
})

describe('toEnglishLayout', () => {
  it('конвертирует ЙЦУКЕН в QWERTY', () => {
    expect(toEnglishLayout('колыбельная')).toBe('rjks,tkmyfz')
  })

  it('сохраняет незнакомые символы', () => {
    expect(toEnglishLayout('фис123')).toBe('abc123')
  })
})

describe('normalizeUmlauts', () => {
  it('убирает умлауты', () => {
    expect(normalizeUmlauts('Flëur')).toBe('Fleur')
  })

  it('убирает акценты', () => {
    expect(normalizeUmlauts('café')).toBe('cafe')
  })

  it('обрабатывает ß', () => {
    expect(normalizeUmlauts('straße')).toBe('strasse')
  })

  it('не трогает кириллицу', () => {
    expect(normalizeUmlauts('ёж')).toBe('ёж')
  })
})

describe('layoutVariants', () => {
  it('возвращает массив вариантов', () => {
    const variants = layoutVariants('test')
    expect(variants).toContain('test')
    expect(variants.length).toBeGreaterThan(1)
  })

  it('включает QWERTY-раскладку', () => {
    const variants = layoutVariants('rjks,tkmyfz')
    expect(variants).toContain('колыбельная')
  })

  it('включает транслит', () => {
    const variants = layoutVariants('слот')
    expect(variants).toContain('slot')
  })

  it('приводит к нижнему регистру', () => {
    const variants = layoutVariants('TEST')
    expect(variants).toContain('test')
  })

  it('убирает дубликаты', () => {
    const variants = layoutVariants('abc')
    const unique = new Set(variants)
    expect(variants.length).toBe(unique.size)
  })
})
