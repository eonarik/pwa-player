// src/stores/player/timeLoop.ts

import type { Ref } from 'vue'
import { audioService } from '@/services/audio/AudioService'

export interface TimeLoopRefs {
  currentTime: Ref<number>
  isPlaying: Ref<boolean>
}

export interface TimeLoop {
  start(): void
  stop(): void
  syncOnce(): void
}

/**
 * rAF-цикл обновления `currentTime`. Запускается на `play`,
 * останавливается на `pause`/`ended`/`stop`.
 *
 * `syncOnce()` — однократная синхронизация (после `seek`).
 */
export function createTimeLoop(refs: TimeLoopRefs): TimeLoop {
  const { currentTime, isPlaying } = refs
  let rafId: number | null = null

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function tick(): void {
    const t = Math.round(audioService.currentTime * 10) / 10
    if (t !== currentTime.value) currentTime.value = t

    if (audioService.paused && !isPlaying.value) {
      stop()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  function start(): void {
    if (rafId !== null) return
    rafId = requestAnimationFrame(tick)
  }

  function syncOnce(): void {
    currentTime.value = Math.round(audioService.currentTime * 10) / 10
  }

  return { start, stop, syncOnce }
}
