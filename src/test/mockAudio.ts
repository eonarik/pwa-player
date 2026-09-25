// src/test/mockAudio.ts

import { vi } from 'vitest'

/**
 * Мок HTMLAudioElement для тестов AudioService.
 * Управляется извне: можно эмулировать любые события через emit*.
 */
export class MockAudio {
  src = ''
  preload = ''
  currentTime = 0
  duration = 0
  volume = 1
  muted = false
  paused = true

  private listeners = new Map<string, Set<EventListener>>()

  addEventListener(event: string, handler: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  removeEventListener(event: string, handler: EventListener) {
    this.listeners.get(event)?.delete(handler)
  }

  load() {
    // no-op
  }

  async play() {
    this.paused = false
    this.emit('play')
  }

  pause() {
    this.paused = true
    this.emit('pause')
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }

  /** Эмуляция события из теста */
  emit(event: string) {
    this.listeners.get(event)?.forEach((handler) => {
      handler(new Event(event))
    })
  }

  /** Очистка — вызвать в afterEach */
  reset() {
    this.listeners.clear()
  }
}
