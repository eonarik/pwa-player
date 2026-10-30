// src/services/library/EntityGraph.ts

import type { Album } from '@/types/album';
import { newAlbumId } from '@/types/ids';

export function findAlbumByName(albums: Album[], name: string, artist: string): Album | null {
  const normName = name.trim().toLowerCase();
  const normArtist = artist.trim().toLowerCase();
  if (!normName) return null;

  return (
    albums.find((a) => a.name.trim().toLowerCase() === normName && a.artist.trim().toLowerCase() === normArtist) ?? null
  );
}

export function resolveAlbumByName(
  name: string,
  artist: string,
  coverUrl: string | null,
  existingAlbums: Album[],
): { album: Album; isNew: boolean } | null {
  const cleanName = name.trim();
  if (!cleanName) return null;

  const existing = findAlbumByName(existingAlbums, cleanName, artist);
  if (existing) {
    if (!existing.coverUrl && coverUrl) {
      return {
        album: { ...existing, coverUrl },
        isNew: false,
      };
    }
    return { album: existing, isNew: false };
  }

  return {
    album: {
      id: newAlbumId(),
      name: cleanName,
      artist: artist || 'Unknown Artist',
      coverUrl,
    },
    isNew: true,
  };
}
