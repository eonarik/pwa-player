// server/src/shared/audio.spec.js

import { describe, it, expect } from 'vitest'
import { isAudioFile, AUDIO_EXTENSIONS } from './audio.js'

describe('isAudioFile', () => {
  it('распознаёт аудио', () => {
    expect(isAudioFile('song.mp3')).toBe(true)
    expect(isAudioFile('song.MP3')).toBe(true)
    expect(isAudioFile('song.flac')).toBe(true)
    expect(isAudioFile('song.wav')).toBe(true)
    expect(isAudioFile('song.ogg')).toBe(true)
    expect(isAudioFile('song.m4a')).toBe(true)
    expect(isAudioFile('song.aac')).toBe(true)
    expect(isAudioFile('song.opus')).toBe(true)
    expect(isAudioFile('song.wma')).toBe(true)
  })

  it('игнорирует не-аудио', () => {
    expect(isAudioFile('song.txt')).toBe(false)
    expect(isAudioFile('folder')).toBe(false)
    expect(isAudioFile('song')).toBe(false)
    expect(isAudioFile('')).toBe(false)
  })

  it('не матчит по подстроке', () => {
    expect(isAudioFile('song.mp3x')).toBe(false)
    expect(isAudioFile('mp3')).toBe(false)
    expect(isAudioFile('.mp3')).toBe(true) // расширение — весь файл, ок
  })

  it('AUDIO_EXTENSIONS содержит точку', () => {
    for (const ext of AUDIO_EXTENSIONS) {
      expect(ext.startsWith('.')).toBe(true)
    }
  })
})
