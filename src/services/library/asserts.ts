// src/services/library/asserts.ts

import type { LibraryTrack } from '@/types/library'

/**
 * Проверяет инварианты `fileLocation` / `handle` / `source`.
 * В dev-режиме логирует нарушение, в prod — no-op.
 *
 * Инварианты:
 * - `'both' | 'local-only'` ⇒ `handle` есть.
 * - `'remote-only'`         ⇒ `source` — непустая строка, `handle` нет.
 * - `'nowhere'`             ⇒ `source` — пустая строка, `handle` нет.
 */
export function assertTrackInvariants(track: LibraryTrack, context: string): void {
  if (!import.meta.env.DEV) return

  const location = track.fileLocation
  if (!location) return

  const hasHandle = Boolean(track.handle)
  const hasSourceString = typeof track.source === 'string' && track.source.length > 0

  if (location === 'both' || location === 'local-only') {
    if (!hasHandle) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="${location}" requires handle, got none for track "${track.id}"`,
      )
    }
    return
  }

  if (location === 'remote-only') {
    if (!hasSourceString) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="remote-only" requires non-empty string source, got ${typeof track.source} for track "${track.id}"`,
      )
    }
    if (hasHandle) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="remote-only" must not have handle for track "${track.id}"`,
      )
    }
    return
  }

  if (location === 'nowhere') {
    if (hasSourceString || hasHandle) {
      console.error(
        `[library:${context}] invariant violated: fileLocation="nowhere" must have empty source and no handle for track "${track.id}"`,
      )
    }
  }
}
