// src/composables/useTrackReaction.ts

import { computed, type Ref } from 'vue'
import { usePlaylistsStore } from '@/stores/playlists'
import { useDislikesStore } from '@/stores/dislikes'
import { usePlayerStore } from '@/stores/player'
import type { Track } from '@/types/track'

/**
 * Общая логика реакций на трек: избранное + дизлайк.
 *
 * - `toggleFavorite` — избранное, не влияет на воспроизведение.
 * - `toggleDislike('toggle')` — из меню: просто переключить дизлайк.
 * - `toggleDislike('skip')` — из плеера: переключить и, если поставили
 *   (а не сняли), перейти к следующему треку.
 */
export function useTrackReaction(track: Ref<Track | null | undefined>) {
  const playlists = usePlaylistsStore()
  const dislikes = useDislikesStore()
  const player = usePlayerStore()

  const isFavorite = computed(() => {
    const id = track.value?.id
    return id ? playlists.isFavorite(id) : false
  })

  const isDisliked = computed(() => {
    const id = track.value?.id
    return id ? dislikes.isDisliked(id) : false
  })

  function toggleFavorite() {
    const t = track.value
    if (!t) return
    playlists.toggleFavorite(t)
  }

  function toggleDislike(mode: 'toggle' | 'skip' = 'toggle') {
    const t = track.value
    if (!t) return

    if (isDisliked.value) {
      dislikes.undislike(t.id)
      return
    }

    dislikes.dislike(t)

    if (mode === 'skip') {
      player.next()
    }
  }

  return {
    isFavorite,
    isDisliked,
    toggleFavorite,
    toggleDislike,
  }
}
