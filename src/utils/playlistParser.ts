// src/utils/playlistParser.ts

import type { PlaylistExportTrack } from '@/types/playlist'

interface RawJSONTrack {
  artist?: string
  title?: string
  album?: string
  duration?: number
  path?: string
}

interface RawJSONPlaylist {
  format?: string
  name?: string
  tracks?: RawJSONTrack[]
}

/**
 * Определяет формат файла по его содержимому.
 */
export function detectPlaylistFormat(content: string): 'm3u' | 'json' | null {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.includes('#EXTM3U') || trimmed.startsWith('#')) return 'm3u'
  return null
}

/**
 * Генерирует M3U-строку из списка треков.
 */
export function exportToM3U(tracks: PlaylistExportTrack[]): string {
  const lines = ['#EXTM3U']

  for (const track of tracks) {
    const artist = track.artist || 'Unknown Artist'
    const title = track.title || 'Unknown Title'
    const duration = track.duration ? Math.floor(track.duration) : -1

    lines.push(`#EXTINF:${duration},${artist} - ${title}`)
    lines.push(track.path || `${artist} - ${title}.mp3`)
  }

  return lines.join('\n')
}

/**
 * Парсит M3U-строку в список треков.
 */
export function parseM3U(content: string): PlaylistExportTrack[] {
  const lines = content.split(/\r?\n/)
  const tracks: PlaylistExportTrack[] = []

  let currentMeta: { artist: string; title: string; duration?: number } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#EXTINF:')) {
        const match = trimmed.match(/#EXTINF:([^,]+),(.+)/)
        if (match) {
          const durationSec = parseFloat(match[1] || '-1')
          const fullTitle = match[2] || ''

          const parts = fullTitle.split(' - ')
          if (parts.length >= 2) {
            currentMeta = {
              artist: parts[0]!.trim(),
              title: parts.slice(1).join(' - ').trim(),
              duration: durationSec > 0 ? durationSec : undefined,
            }
          } else {
            currentMeta = {
              artist: '',
              title: fullTitle.trim(),
              duration: durationSec > 0 ? durationSec : undefined,
            }
          }
        }
      }
      continue
    }

    if (currentMeta) {
      tracks.push({
        ...currentMeta,
        path: trimmed,
      })
      currentMeta = null
    } else {
      const filename = trimmed.split('/').pop() || trimmed
      const cleanTitle = filename.replace(/\.[^.]+$/, '')

      tracks.push({
        artist: '',
        title: cleanTitle,
        path: trimmed,
      })
    }
  }

  return tracks
}

/**
 * Экспорт в JSON.
 */
export function exportToJSON(name: string, tracks: PlaylistExportTrack[]): string {
  return JSON.stringify(
    {
      format: 'cuei-playlist',
      version: 1,
      name,
      tracks,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  )
}

/**
 * Парсинг JSON.
 */
export function parseJSON(content: string): { name: string; tracks: PlaylistExportTrack[] } | null {
  try {
    const data = JSON.parse(content) as RawJSONPlaylist

    if (data.format !== 'cuei-playlist' || !Array.isArray(data.tracks)) {
      return null
    }

    return {
      name: data.name || 'Импортированный плейлист',
      tracks: data.tracks.map((t) => ({
        artist: t.artist || '',
        title: t.title || 'Unknown Title',
        album: t.album,
        duration: t.duration,
        path: t.path,
      })),
    }
  } catch {
    return null
  }
}
