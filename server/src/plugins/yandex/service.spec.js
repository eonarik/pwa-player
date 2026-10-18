import { describe, it, expect } from 'vitest'
import { resolveDiskPath, toClientPath, isAudioFile } from './service.js'

describe('yandex service', () => {
  describe('resolveDiskPath', () => {
    it('корень', () => expect(resolveDiskPath('/')).toBe('app:/'))
    it('вложенный', () => expect(resolveDiskPath('/Music')).toBe('app:/Music'))
    it('traversal', () => expect(resolveDiskPath('/../secret')).toBe('app:/secret'))
  })
  describe('toClientPath', () => {
    it('корень', () => expect(toClientPath('app:/')).toBe('/'))
    it('вложенный', () => expect(toClientPath('app:/Music')).toBe('/Music'))
  })
  describe('isAudioFile', () => {
    it('mp3', () => expect(isAudioFile('song.mp3')).toBe(true))
    it('txt', () => expect(isAudioFile('song.txt')).toBe(false))
  })
})
