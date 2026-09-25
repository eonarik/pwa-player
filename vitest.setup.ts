/* eslint-disable @typescript-eslint/no-explicit-any */
// vitest.setup.ts

import { vi } from 'vitest'
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
