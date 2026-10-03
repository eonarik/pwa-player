// server/src/disk/normalize.spec.js

import { describe, it, expect } from 'vitest'
import { normalizeClientPath } from './normalize.js'

describe('normalizeClientPath', () => {
  it('убирает префикс disk:', () => {
    expect(normalizeClientPath('disk:/Music/Rock')).toBe('Music/Rock')
  })

  it('убирает ведущие и хвостовые слэши', () => {
    expect(normalizeClientPath('/Music/Rock/')).toBe('Music/Rock')
    expect(normalizeClientPath('///Music///Rock///')).toBe('Music/Rock')
  })

  it('пустая строка и корень дают пустой результат', () => {
    expect(normalizeClientPath('')).toBe('')
    expect(normalizeClientPath('/')).toBe('')
    expect(normalizeClientPath('//')).toBe('')
    expect(normalizeClientPath('disk:/')).toBe('')
  })

  it('схлопывает . и ..', () => {
    expect(normalizeClientPath('Music/./Rock')).toBe('Music/Rock')
    expect(normalizeClientPath('Music/Rock/../Pop')).toBe('Music/Pop')
    expect(normalizeClientPath('Music/Rock/../../Pop')).toBe('Pop')
  })

  it('ведущие .. игнорируются — из-за корня не выйти', () => {
    expect(normalizeClientPath('../../secret')).toBe('secret')
    expect(normalizeClientPath('/../secret')).toBe('secret')
    expect(normalizeClientPath('Music/../../secret')).toBe('secret')
  })

  it('path traversal: атака из README', () => {
    expect(normalizeClientPath('/nostalgy/../../../secret')).toBe('secret')
    expect(normalizeClientPath('/nostalgy/2020/../2021')).toBe('nostalgy/2021')
  })

  it('сохраняет одиночные сегменты', () => {
    expect(normalizeClientPath('Music')).toBe('Music')
    expect(normalizeClientPath('/Music')).toBe('Music')
  })

  it('сохраняет кириллицу и пробелы', () => {
    expect(normalizeClientPath('/Логии/LoGii3026')).toBe('Логии/LoGii3026')
    expect(normalizeClientPath('/Моя музыка/2020')).toBe('Моя музыка/2020')
  })

  it('смешанный префикс disk: с ../', () => {
    expect(normalizeClientPath('disk:/Music/../secret')).toBe('secret')
  })
})
