// oxlint-disable vitest/require-mock-type-parameters vitest/require-to-throw-message
// src/services/audio/AudioService.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioService } from './AudioService'
import { audioMockState } from '@/test/audioMockState'
import { MockAudio } from '@/test/mockAudio'

/**
 * Каждый тест создаёт свежий инстанс AudioService.
 * Глобальный Audio мокнут в vitest.setup.ts через MockAudio.
 */
function createService(): AudioService {
  // @ts-expect-error — приватный конструктор, но нужен свежий инстанс
  return new AudioService()
}

describe('AudioService', () => {
  let service: AudioService

  beforeEach(() => {
    audioMockState.reset()
    service = createService()
  })

  afterEach(() => {
    // Очищаем всех слушателей у mock-инстанса
    const instance = audioMockState.instances[0] as MockAudio | undefined
    instance?.reset()
  })

  // --- load / unload ---------------------------------------------------

  describe('load', () => {
    it('устанавливает src для строки', () => {
      service.load('https://example.com/song.mp3')
      const instance = audioMockState.instances[0] as unknown as MockAudio
      expect(instance.src).toBe('https://example.com/song.mp3')
    })

    it('создаёт objectURL для File', () => {
      const file = new File(['data'], 'song.mp3', { type: 'audio/mpeg' })
      service.load(file)

      expect(URL.createObjectURL).toHaveBeenCalledWith(file)
      const instance = audioMockState.instances[0] as unknown as MockAudio
      expect(instance.src).toMatch(/^blob:/)
    })

    it('создаёт objectURL для Blob', () => {
      const blob = new Blob(['data'], { type: 'audio/mpeg' })
      service.load(blob)

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    })

    it('revoke предыдущий objectURL при повторной загрузке', () => {
      const blob1 = new Blob(['1'])
      service.load(blob1)
      const url1 = (audioMockState.instances[0] as unknown as MockAudio).src

      const blob2 = new Blob(['2'])
      service.load(blob2)

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url1)
    })
  })

  describe('unload', () => {
    it('сбрасывает src и revoke objectURL', () => {
      const blob = new Blob(['data'])
      service.load(blob)
      const url = (audioMockState.instances[0] as unknown as MockAudio).src

      service.unload()

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
      const instance = audioMockState.instances[0] as unknown as MockAudio
      expect(instance.src).toBe('')
    })

    it('безопасен без активного src', () => {
      expect(() => service.unload()).not.toThrow()
    })
  })

  // --- play / pause ----------------------------------------------------

  describe('play / pause', () => {
    it('play вызывает audio.play', async () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      const spy = vi.spyOn(instance, 'play')

      await service.play()
      expect(spy).toHaveBeenCalled()
    })

    it('pause вызывает audio.pause', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      const spy = vi.spyOn(instance, 'pause')

      service.pause()
      expect(spy).toHaveBeenCalled()
    })

    it('play эмитит error при исключении', async () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      vi.spyOn(instance, 'play').mockRejectedValueOnce(new Error('NotAllowedError'))

      const listener = vi.fn()
      service.on('error', listener)

      await expect(service.play()).rejects.toThrow()
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('NotAllowedError') }),
      )
    })

    it('toggle: paused → play', async () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.paused = true

      const playSpy = vi.spyOn(instance, 'play').mockResolvedValue(undefined)
      await service.toggle()

      expect(playSpy).toHaveBeenCalled()
    })

    it('toggle: playing → pause', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.paused = false

      const pauseSpy = vi.spyOn(instance, 'pause')
      service.toggle()

      expect(pauseSpy).toHaveBeenCalled()
    })
  })

  // --- seek ------------------------------------------------------------

  describe('seek', () => {
    it('устанавливает currentTime в допустимых границах', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.duration = 100

      service.seek(50)
      expect(instance.currentTime).toBe(50)
    })

    it('клампит отрицательное значение', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.duration = 100

      service.seek(-10)
      expect(instance.currentTime).toBe(0)
    })

    it('клампит значение больше duration', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.duration = 100

      service.seek(200)
      expect(instance.currentTime).toBe(100)
    })

    it('игнорирует NaN', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.currentTime = 42

      service.seek(NaN)
      expect(instance.currentTime).toBe(42)
    })

    it('seekBy сдвигает от текущей позиции', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.duration = 100
      instance.currentTime = 50

      service.seekBy(10)
      expect(instance.currentTime).toBe(60)
    })
  })

  // --- volume ----------------------------------------------------------

  describe('volume', () => {
    it('setVolume в допустимых границах', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      service.setVolume(0.5)
      expect(instance.volume).toBe(0.5)
    })

    it('клампит отрицательное', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      service.setVolume(-1)
      expect(instance.volume).toBe(0)
    })

    it('клампит больше 1', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      service.setVolume(5)
      expect(instance.volume).toBe(1)
    })

    it('setMuted устанавливает muted', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      service.setMuted(true)
      expect(instance.muted).toBe(true)
    })
  })

  // --- события ---------------------------------------------------------

  describe('on / off / emit', () => {
    it('on вызывает listener при событии', () => {
      const listener = vi.fn()
      service.on('play', listener)

      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.emit('play')

      expect(listener).toHaveBeenCalledOnce()
    })

    it('off отписывает listener', () => {
      const listener = vi.fn()
      service.on('play', listener)
      service.off('play', listener)

      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.emit('play')

      expect(listener).not.toHaveBeenCalled()
    })

    it('несколько listener на одно событие', () => {
      const l1 = vi.fn()
      const l2 = vi.fn()
      service.on('play', l1)
      service.on('play', l2)

      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.emit('play')

      expect(l1).toHaveBeenCalledOnce()
      expect(l2).toHaveBeenCalledOnce()
    })

    it('listener не срывает другие при исключении', () => {
      const bad = vi.fn(() => {
        throw new Error('boom')
      })
      const good = vi.fn()
      service.on('play', bad)
      service.on('play', good)

      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.emit('play')

      expect(bad).toHaveBeenCalled()
      expect(good).toHaveBeenCalled()
    })

    it('loadedmetadata эмитит duration', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.duration = 123

      const listener = vi.fn()
      service.on('loadedmetadata', listener)
      instance.emit('loadedmetadata')

      expect(listener).toHaveBeenCalledWith({ duration: 123 })
    })

    it('timeupdate эмитит currentTime и duration', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.currentTime = 5
      instance.duration = 100

      const listener = vi.fn()
      service.on('timeupdate', listener)
      instance.emit('timeupdate')

      expect(listener).toHaveBeenCalledWith({ currentTime: 5, duration: 100 })
    })

    it('volumechange эмитит volume и muted', () => {
      const instance = audioMockState.instances[0] as unknown as MockAudio
      instance.volume = 0.7
      instance.muted = true

      const listener = vi.fn()
      service.on('volumechange', listener)
      instance.emit('volumechange')

      expect(listener).toHaveBeenCalledWith({ volume: 0.7, muted: true })
    })
  })

  // --- destroy ---------------------------------------------------------

  describe('destroy', () => {
    it('не падает при повторном вызове', () => {
      expect(() => {
        service.destroy()
      }).not.toThrow()
    })

    it('очищает objectURL', () => {
      const blob = new Blob(['data'])
      service.load(blob)
      const url = (audioMockState.instances[0] as unknown as MockAudio).src

      service.destroy()
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    })
  })
})
