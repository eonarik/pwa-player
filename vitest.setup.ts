/* eslint-disable @typescript-eslint/no-explicit-any */
// vitest.setup.ts

import { vi, beforeEach, afterEach } from 'vitest'
import { MockAudio } from './src/test/mockAudio'
import { audioMockState } from './src/test/audioMockState'

// Прямое присваивание вместо stubGlobal — надёжнее для jsdom-встроенных классов
;(globalThis as any).Audio = class {
  constructor() {
    const instance = new MockAudio()
    audioMockState.instances.push(instance)
    return instance
  }
}

vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
  audioMockState.urlCounter++
  return `blob:mock-${audioMockState.urlCounter}`
})

vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
  audioMockState.revokedUrls.push(url)
})

// --- Заглушка консоли -------------------------------------------------
// Код осознанно пишет warn/error в «отрицательных» сценариях.
// В тестах это шум. Глушим глобально, но оставляем возможность
// перехватить конкретный вызов через vi.spyOn внутри теста.

let consoleWarnSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>
let consoleInfoSpy: ReturnType<typeof vi.spyOn>
let consoleLogSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleWarnSpy.mockRestore()
  consoleErrorSpy.mockRestore()
  consoleInfoSpy.mockRestore()
  consoleLogSpy.mockRestore()
})
