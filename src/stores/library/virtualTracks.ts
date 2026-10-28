// src/stores/library/virtualTracks.ts

import type { Ref } from 'vue'
import type { LibraryTrack, Album } from '@/types/library'
import { virtualTracksService } from '@/services/persistence/VirtualTracksService'

export interface VirtualTracksDeps {
  tracks: Ref<Record<string, LibraryTrack>>
  virtualTracks: Ref<Record<string, LibraryTrack>>
  albums: Ref<Record<string, Album>>
}

export function createVirtualTracks(deps: VirtualTracksDeps) {
  const { tracks, virtualTracks, albums } = deps

  function addVirtualTrack(track: LibraryTrack): void {
    if (tracks.value[track.id]) return

    virtualTracks.value[track.id] = track
    tracks.value[track.id] = track
    void virtualTracksService.saveAll(virtualTracks.value)
  }

  function removeVirtualTrack(trackId: string): void {
    const track = virtualTracks.value[trackId]
    if (!track) return

    if (track.albumId) {
      const album = albums.value[track.albumId]
      if (album) {
        album.trackIds = album.trackIds.filter((id) => id !== trackId)
        if (album.trackIds.length === 0) {
          delete albums.value[track.albumId]
        }
      }
    }

    delete virtualTracks.value[trackId]
    delete tracks.value[trackId]
    void virtualTracksService.saveAll(virtualTracks.value)
  }

  async function restoreVirtualTracks(): Promise<void> {
    const saved = await virtualTracksService.loadAll()

    for (const track of Object.values(saved)) {
      if (!tracks.value[track.id]) {
        tracks.value[track.id] = track
        virtualTracks.value[track.id] = track

        if (track.albumId && track.album) {
          const existingAlbum = albums.value[track.albumId]
          if (!existingAlbum) {
            albums.value[track.albumId] = {
              id: track.albumId,
              name: track.album,
              artist: track.artist,
              coverUrl: track.raw?.coverUrl,
              trackIds: [track.id],
            }
          } else {
            if (!existingAlbum.trackIds.includes(track.id)) {
              existingAlbum.trackIds.push(track.id)
            }
            if (!existingAlbum.coverUrl && track.raw?.coverUrl) {
              existingAlbum.coverUrl = track.raw.coverUrl
            }
          }
        }
      }
    }
  }

  function clearVirtualTracks(): void {
    virtualTracks.value = {}
    void virtualTracksService.clear()
  }

  return {
    addVirtualTrack,
    removeVirtualTrack,
    restoreVirtualTracks,
    clearVirtualTracks,
  }
}
