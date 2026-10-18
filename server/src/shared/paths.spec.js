import { describe, it, expect } from 'vitest'
import { normalizeClientPath } from './paths.js'

describe('normalizeClientPath', () => {
  it('убирает префикс disk:', () => {
    expect(normalizeClientPath('disk:/Music/Rock')).toBe('Music/Rock')
  })
  it('убирает слэши', () => {
    expect(normalizeClientPath('///Music///Rock///')).toBe('Music/Rock')
  })
  it('схлопывает ..', () => {
    expect(normalizeClientPath('Music/Rock/../../Pop')).toBe('Pop')
    expect(normalizeClientPath('/../secret')).toBe('secret')
  })
})
