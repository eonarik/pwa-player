// src/composables/useResolvedTracks.ts

import { computed, type Ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { isStreamingPlugin } from '@/plugins/registry'
import type { TrackSnapshot } from '@/types/snapshot'
import type { Track } from '@/types/track'

export function useResolvedTracks(snapshots: Ref<TrackSnapshot[]>) {
  const library = useLibraryStore()

  return computed<Track[]>(() => {
    const result: Track[] = []

    for (const snapshot of snapshots.value) {
      const libTrack = library.getTrack(snapshot.id)

      if (libTrack) {
        // Мержим данные: если у локального трека чего-то нет, берем из снимка
        result.push({
          ...libTrack,
          artist: libTrack.artist || snapshot.artist || '',
          title: libTrack.title || snapshot.title || '',
          album: libTrack.album || snapshot.album || '',
          coverUrl: libTrack.coverUrl || snapshot.coverUrl,
          duration: libTrack.duration || snapshot.duration,
          // source не трогаем, он должен быть у локального трека (если он remote)
        })
      } else if (isStreamingPlugin(snapshot.pluginId) && snapshot.source) {
        result.push({
          id: snapshot.id,
          pluginId: snapshot.pluginId,
          title: snapshot.title,
          artist: snapshot.artist,
          album: snapshot.album ?? '',
          duration: snapshot.duration ?? 0,
          coverUrl: snapshot.coverUrl,
          filename: '',
          source: snapshot.source,
        })
      }
    }

    return result
  })
}
