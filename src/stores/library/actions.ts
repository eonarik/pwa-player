// src/stores/library/actions.ts

import type { Ref } from 'vue'
import type { LibraryTrack } from '@/types/library'
import { librarySaveService } from '@/services/library/LibrarySaveService'

export interface AlternateActionsDeps {
  tracks: Ref<Record<string, LibraryTrack>>
}

export function createAlternateActions(deps: AlternateActionsDeps) {
  const { tracks } = deps

  /**
   * Подтверждает альтернативный источник (переносит в sources).
   */
  function confirmAlternate(trackId: string, altSourceId: string): void {
    const track = tracks.value[trackId]
    if (!track || !track.alternateSources) return

    const alt = track.alternateSources.find((s) => s.id === altSourceId)
    if (!alt) return

    // Добавляем в основной sources
    if (!track.sources.some((s) => s.id === alt.id)) {
      track.sources.push(alt)
      track.sources.sort((a, b) => a.priority - b.priority)
    }

    // Удаляем из альтернативных
    track.alternateSources = track.alternateSources.filter((s) => s.id !== altSourceId)

    if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
  }

  /**
   * Отклоняет альтернативный источник (просто удаляет).
   */
  function dismissAlternate(trackId: string, altSourceId: string): void {
    const track = tracks.value[trackId]
    if (!track || !track.alternateSources) return

    track.alternateSources = track.alternateSources.filter((s) => s.id !== altSourceId)

    if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
  }

  return {
    confirmAlternate,
    dismissAlternate,
  }
}
