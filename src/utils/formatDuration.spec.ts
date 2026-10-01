// src/utils/formatDuration.spec.ts

import { describe, it, expect } from 'vitest'
import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('форматирует секунды в m:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(1)).toBe('0:01')
    expect(formatDuration(59)).toBe('0:59')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('округляет дробные секунды вниз', () => {
    expect(formatDuration(59.9)).toBe('0:59')
    expect(formatDuration(60.5)).toBe('1:00')
  })

  it('возвращает --:-- для некорректных значений', () => {
    expect(formatDuration(null)).toBe('--:--')
    expect(formatDuration(undefined)).toBe('--:--')
    expect(formatDuration(NaN)).toBe('--:--')
    expect(formatDuration(Infinity)).toBe('--:--')
    expect(formatDuration(-1)).toBe('--:--')
  })
})
