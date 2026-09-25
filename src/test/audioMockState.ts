// src/test/audioMockState.ts

import type { MockAudio } from './mockAudio'

/**
 * Разделяемое состояние мока Audio для тестов.
 * Экспортируется как обычный модуль — не нужны никакие globalThis-трюки.
 */
export const audioMockState = {
  instances: [] as MockAudio[],
  revokedUrls: [] as string[],
  urlCounter: 0,

  reset() {
    this.instances.length = 0
    this.revokedUrls.length = 0
    this.urlCounter = 0
  },
}
