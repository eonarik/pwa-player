// src/stores/player/playerPersistence.ts

import type { Ref } from 'vue'
import { persistenceService } from '@/services/persistence/PersistenceService'
import type { PersistedPlayback, PersistedState } from '@/services/persistence/types'
import type { Track } from '@/types/track'

export interface PlayerPersistenceRefs {
  queue: Ref<Track[]>
  currentIndex: Ref<number>
  currentTime: Ref<number>
  volume: Ref<number>
  muted: Ref<boolean>
  repeatMode: Ref<'off' | 'one' | 'all'>
  shuffle: Ref<boolean>
  currentTrack: Ref<Track | null>
}

export interface PlayerPersistence {
  buildState(): PersistedState
  buildPlayback(): PersistedPlayback
  flushPlayback(): Promise<void>
  flushState(): Promise<void>
  subscribeFlushOnUnload(): () => void
}

/**
 * Персистентность плеера: снимок очереди/состояния и позиции,
 * дебаунс через PersistenceService, флаш при уходе со страницы.
 */
export function createPlayerPersistence(refs: PlayerPersistenceRefs): PlayerPersistence {
  const { queue, currentIndex, currentTime, volume, muted, repeatMode, shuffle, currentTrack } =
    refs

  function buildState(): PersistedState {
    return {
      tracks: queue.value.map((t) => persistenceService.toPersisted(t)),
      currentIndex: currentIndex.value,
      volume: volume.value,
      muted: muted.value,
      repeatMode: repeatMode.value,
      shuffle: shuffle.value,
      savedAt: Date.now(),
    }
  }

  function buildPlayback(): PersistedPlayback {
    return {
      currentTime: currentTime.value,
      trackId: currentTrack.value?.id ?? null,
      savedAt: Date.now(),
    }
  }

  async function flushPlayback(): Promise<void> {
    await persistenceService.savePlaybackNow(buildPlayback())
  }

  async function flushState(): Promise<void> {
    await persistenceService.saveStateNow(buildState())
  }

  /**
   * Подписка на beforeunload / pagehide / visibilitychange.
   * Возвращает функцию отписки (для $dispose).
   */
  function subscribeFlushOnUnload(): () => void {
    if (typeof window === 'undefined') return () => {}

    const flush = (): void => {
      void flushState()
      void flushPlayback()
    }

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }

  return {
    buildState,
    buildPlayback,
    flushPlayback,
    flushState,
    subscribeFlushOnUnload,
  }
}
