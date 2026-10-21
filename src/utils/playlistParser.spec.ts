// src/utils/playlistParser.spec.ts

import { describe, it, expect } from 'vitest'
import { exportToM3U, parseM3U, exportToJSON, parseJSON } from './playlistParser'

describe('playlistParser', () => {
  describe('M3U', () => {
    it('экспортирует и парсит обратно', () => {
      const tracks = [
        { artist: 'Radiohead', title: 'Karma Police', duration: 261, path: '/music/karma.mp3' },
        { artist: 'Portishead', title: 'Glory Box', duration: 300, path: '/music/glory.mp3' },
      ]

      const m3u = exportToM3U(tracks)
      expect(m3u).toContain('#EXTM3U')
      expect(m3u).toContain('#EXTINF:261,Radiohead - Karma Police')

      const parsed = parseM3U(m3u)
      expect(parsed).toHaveLength(2)
      expect(parsed[0]!.artist).toBe('Radiohead')
      expect(parsed[0]!.title).toBe('Karma Police')
      expect(parsed[0]!.path).toBe('/music/karma.mp3')
    })

    it('парсит трек без артиста (только Title)', () => {
      const m3u = `#EXTM3U\n#EXTINF:-1,Song Title\n/song.mp3`
      const parsed = parseM3U(m3u)
      expect(parsed[0]!.artist).toBe('')
      expect(parsed[0]!.title).toBe('Song Title')
    })

    it('парсит URL потока', () => {
      const m3u = `#EXTM3U\n#EXTINF:-1,Radio Station\nhttp://stream.url/play`
      const parsed = parseM3U(m3u)
      expect(parsed[0]!.path).toBe('http://stream.url/play')
    })
  })

  describe('JSON', () => {
    it('экспортирует и парсит обратно', () => {
      const tracks = [{ artist: 'A', title: 'T', album: 'Al' }]
      const json = exportToJSON('My Playlist', tracks)

      const parsed = parseJSON(json)
      expect(parsed).not.toBeNull()
      expect(parsed!.name).toBe('My Playlist')
      expect(parsed!.tracks[0]!.artist).toBe('A')
    })

    it('возвращает null при неверном формате', () => {
      expect(parseJSON('{}')).toBeNull()
      expect(parseJSON('invalid json')).toBeNull()
    })
  })
})
