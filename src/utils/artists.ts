// src/utils/artists.ts

import type { LibraryTrack } from '@/types/library'

export const NO_ALBUM_SLUG = 'no-album'
export const NO_ALBUM_LABEL = 'Без альбома'

export interface AlbumGroup {
  /** Ключ: track.album или '' для «без альбома» */
  album: string
  /** Slug для URL: track.album или NO_ALBUM_SLUG */
  slug: string
  /** Отображаемое имя: track.album или NO_ALBUM_LABEL */
  name: string
  /** Треки альбома, отсортированные */
  tracks: LibraryTrack[]
  /** Обложка — первый трек с coverUrl */
  coverUrl: string | undefined
}

/**
 * Группирует треки по альбомам.
 * Возвращает массив групп, отсортированный по имени альбома.
 * «Без альбома» — в конце.
 */
export function groupByAlbum(tracks: LibraryTrack[]): AlbumGroup[] {
  const map = new Map<string, LibraryTrack[]>()
  for (const track of tracks) {
    const key = track.album?.trim() ?? ''
    const list = map.get(key)
    if (list) {
      list.push(track)
    } else {
      map.set(key, [track])
    }
  }

  const groups: AlbumGroup[] = []
  for (const [album, list] of map) {
    const sorted = [...list].sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER
      if (an !== bn) return an - bn
      return a.title.localeCompare(b.title, 'ru')
    })

    groups.push({
      album,
      slug: album || NO_ALBUM_SLUG,
      name: album || NO_ALBUM_LABEL,
      tracks: sorted,
      coverUrl: sorted.find((t) => t.coverUrl)?.coverUrl,
    })
  }

  groups.sort((a, b) => {
    if (!a.album) return 1
    if (!b.album) return -1
    return a.album.localeCompare(b.album, 'ru')
  })

  return groups
}

/**
 * Возвращает все треки артиста из библиотеки (регистронезависимо).
 */
export function filterTracksByArtist(tracks: LibraryTrack[], artistName: string): LibraryTrack[] {
  const needle = artistName.trim().toLowerCase()
  if (!needle) return []
  return tracks.filter((t) => t.artist?.trim().toLowerCase() === needle)
}
