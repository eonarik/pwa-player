// src/services/library/asserts.ts

import type { LibraryTrack } from '@/types/library'

export function assertTrackInvariants(track: LibraryTrack, context: string): void {
  if (!import.meta.env.DEV) return

  const location = track.fileLocation
  if (!location) return

  const hasHandle = Boolean(track.handle)
  const hasSources = Array.isArray(track.sources) && track.sources.length > 0

  if (location === 'both' || location === 'local-only') {
    if (!hasHandle) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="${location}" requires handle, got none for track "${track.id}"`,
      )
    }
    return
  }

  if (location === 'remote-only') {
    if (!hasSources) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="remote-only" requires sources, got none for track "${track.id}"`,
      )
    }
    return
  }

  if (location === 'nowhere') {
    if (hasSources || hasHandle) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="nowhere" must have no sources and no handle for track "${track.id}"`,
      )
    }
  }
}
