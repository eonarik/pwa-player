// src/stores/library/albums.ts

import type { Ref } from 'vue'
import type { Album } from '@/types/library'
import { albumService } from '@/services/persistence/AlbumService'

export interface AlbumsDeps {
  albums: Ref<Record<string, Album>>
}

export function createAlbums(deps: AlbumsDeps) {
  const { albums } = deps

  async function restoreAlbums(): Promise<void> {
    const saved = await albumService.loadAll()
    albums.value = saved
  }

  function cleanupOrphanAlbums(): void {
    const orphanIds: string[] = []
    for (const [id, album] of Object.entries(albums.value)) {
      if (album.trackIds.length === 0) {
        orphanIds.push(id)
      }
    }
    for (const id of orphanIds) {
      delete albums.value[id]
    }
  }

  function clearAlbums(): void {
    albums.value = {}
    void albumService.clear()
  }

  return {
    restoreAlbums,
    cleanupOrphanAlbums,
    clearAlbums,
  }
}
