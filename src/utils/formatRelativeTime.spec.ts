// src/utils/formatRelativeTime.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime } from './formatRelativeTime'

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('только что', () => {
    expect(formatRelativeTime(Date.now() - 10_000)).toBe('только что')
    expect(formatRelativeTime(Date.now())).toBe('только что')
  })

  it('минуты', () => {
    expect(formatRelativeTime(Date.now() - 60_000)).toBe('1 мин назад')
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5 мин назад')
    expect(formatRelativeTime(Date.now() - 59 * 60_000)).toBe('59 мин назад')
  })

  it('часы', () => {
    expect(formatRelativeTime(Date.now() - 60 * 60_000)).toBe('1 ч назад')
    expect(formatRelativeTime(Date.now() - 5 * 3_600_000)).toBe('5 ч назад')
    expect(formatRelativeTime(Date.now() - 23 * 3_600_000)).toBe('23 ч назад')
  })

  it('дни', () => {
    expect(formatRelativeTime(Date.now() - 24 * 3_600_000)).toBe('1 дн назад')
    expect(formatRelativeTime(Date.now() - 3 * 86_400_000)).toBe('3 дн назад')
    expect(formatRelativeTime(Date.now() - 6 * 86_400_000)).toBe('6 дн назад')
  })

  it('дата, если больше недели', () => {
    const result = formatRelativeTime(Date.now() - 10 * 86_400_000)
    // 05 июн
    expect(result).toMatch(/\d{1,2}\s+\S+/)
  })
})
