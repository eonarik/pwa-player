// src/utils/trackSnapshot.spec.ts
import { describe, it, expect } from 'vitest'
import { createTrackSnapshot } from './trackSnapshot'
import type { Track } from '@/types/track'

describe('createTrackSnapshot', () => {
  it('сохраняет все поля трека', () => {
    const track: Track = {
      id: 'track:zvuk:123',
      pluginId: 'zvuk',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      duration: 180,
      coverUrl: 'https://cover',
      source: 'https://stream.url',
      filename: 'song.mp3',
    }

    const snapshot = createTrackSnapshot(track)

    expect(snapshot.id).toBe('track:zvuk:123')
    expect(snapshot.pluginId).toBe('zvuk')
    expect(snapshot.title).toBe('Song')
    expect(snapshot.source).toBe('https://stream.url')
    expect(snapshot.coverUrl).toBe('https://cover')
    expect(snapshot.duration).toBe(180)
  })

  it('корректно обрабатывает отсутствие опциональных полей', () => {
    const track: Track = {
      id: 'track:local:1',
      pluginId: 'local',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      filename: 'song.mp3',
      source: '',
    }

    const snapshot = createTrackSnapshot(track)

    expect(snapshot.coverUrl).toBeUndefined()
    expect(snapshot.duration).toBeUndefined()
    expect(snapshot.remotePath).toBeUndefined()
  })

  it('извлекает remotePath, если он есть', () => {
    const track: Track = {
      id: 'track:yandex:1',
      pluginId: 'yandex',
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      filename: 'song.mp3',
      source: '',
      remotePath: 'disk:/Music/song.mp3',
    } as Track // Каст, так как remotePath нет в базовом Track, но он есть в LibraryTrack

    const snapshot = createTrackSnapshot(track)
    expect(snapshot.remotePath).toBe('disk:/Music/song.mp3')
  })
})
