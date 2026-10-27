// src/utils/trackSnapshot.ts
import type { Track } from '@/types/track'
import type { TrackSnapshot } from '@/types/snapshot'

export function createTrackSnapshot(track: Track): TrackSnapshot {
  return {
    ...track,
    source: track.source,
  }
}
