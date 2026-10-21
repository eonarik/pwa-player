// src/shared/audioExtensions.spec.ts

import { describe, it, expect } from 'vitest'
import { isAudioFile, AUDIO_EXTENSIONS } from './audioExtensions'

describe('isAudioFile', () => {
  it('распознаёт аудио', () => {
    expect(isAudioFile('song.mp3')).toBe(true)
    expect(isAudioFile('song.MP3')).toBe(true)
    expect(isAudioFile('song.flac')).toBe(true)
  })

  it('игнорирует не-аудио', () => {
    expect(isAudioFile('song.txt')).toBe(false)
    expect(isAudioFile('folder')).toBe(false)
  })

  it('не матчит по подстроке', () => {
    expect(isAudioFile('song.mp3x')).toBe(false)
  })

  it('AUDIO_EXTENSIONS содержит точку', () => {
    for (const ext of AUDIO_EXTENSIONS) {
      expect(ext.startsWith('.')).toBe(true)
    }
  })
})
