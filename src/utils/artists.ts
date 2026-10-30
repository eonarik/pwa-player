// src/utils/artists.ts

import type { Track } from '@/types/track';

export const NO_ALBUM_SLUG = 'no-album';
export const NO_ALBUM_LABEL = 'Без альбома';

export interface AlbumGroup {
  album: string;
  slug: string;
  name: string;
  tracks: Track[];
  coverUrl: string | undefined;
}

export function groupByAlbum(tracks: Track[]): AlbumGroup[] {
  // album = track.albumId ?? '' (id, не имя)
  const map = new Map<string, Track[]>();
  for (const track of tracks) {
    const key = track.albumId ?? '';
    const list = map.get(key);
    if (list) list.push(track);
    else map.set(key, [track]);
  }

  const groups: AlbumGroup[] = [];
  for (const [album, list] of map) {
    const sorted = [...list].sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER;
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER;
      if (an !== bn) return an - bn;
      return a.title.localeCompare(b.title, 'ru');
    });

    groups.push({
      album, // albumId
      slug: album || NO_ALBUM_SLUG,
      name: album || NO_ALBUM_LABEL, // «Без альбома» или albumId (заменит вызывающий)
      tracks: sorted,
      coverUrl: undefined,
    });
  }

  groups.sort((a, b) => {
    if (!a.album) return 1;
    if (!b.album) return -1;
    return a.album.localeCompare(b.album, 'ru');
  });

  return groups;
}

export function filterTracksByArtist(tracks: Track[], artistName: string): Track[] {
  const needle = artistName.trim().toLowerCase();
  if (!needle) return [];
  return tracks.filter((t) => t.artist?.trim().toLowerCase() === needle);
}
