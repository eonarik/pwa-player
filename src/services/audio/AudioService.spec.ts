/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/audio/AudioService.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockAudio } from '@/test/mockAudio'
import { audioMockState } from '@/test/audioMockState'

// Динамический импорт — выполнится после stubGlobal
const { AudioService } = await import('./AudioService')

describe('AudioService', () => {
  let currentAudio: MockAudio

  beforeEach(() => {
    audioMockState.reset()
    // Не надо destroy+getInstance — просто убиваем и создаём заново
    if ((AudioService as any).instance) {
      ;(AudioService as any).instance = null
    }
    AudioService.getInstance()
    currentAudio = audioMockState.instances[0]!
  })

  afterEach(() => {
    // Просто обнуляем singleton, не вызывая destroy (он может создать новый)
    ;(AudioService as any).instance = null
  })

  describe('singleton', () => {
    it('getInstance всегда возвращает один и тот же экземпляр', () => {
      const a = AudioService.getInstance()
      const b = AudioService.getInstance()
      expect(a).toBe(b)
    })
  })

  describe('load', () => {
    it('устанавливает src для строкового URL', () => {
      const service = AudioService.getInstance()
      service.load('https://example.com/track.mp3')
      expect(currentAudio.src).toBe('https://example.com/track.mp3')
    })

    it('создаёт objectURL для File', () => {
      const service = AudioService.getInstance()
      const file = new File(['content'], 'track.mp3', { type: 'audio/mpeg' })
      service.load(file)
      expect(currentAudio.src).toMatch(/^blob:mock-/)
    })

    it('создаёт objectURL для Blob', () => {
      const service = AudioService.getInstance()
      const blob = new Blob(['content'], { type: 'audio/mpeg' })
      service.load(blob)
      expect(currentAudio.src).toMatch(/^blob:mock-/)
    })

    it('ревокает предыдущий objectURL при загрузке нового', () => {
      const service = AudioService.getInstance()
      const file1 = new File(['a'], 'a.mp3')
      const file2 = new File(['b'], 'b.mp3')

      service.load(file1)
      const firstUrl = currentAudio.src

      service.load(file2)

      expect(audioMockState.revokedUrls).toContain(firstUrl)
    })
  })

  describe('play', () => {
    it('эмитит play и снимает paused', async () => {
      const service = AudioService.getInstance()
      const handler = vi.fn()
      service.on('play', handler)

      service.load('https://example.com/track.mp3')
      await service.play()

      expect(handler).toHaveBeenCalledTimes(1)
      expect(service.paused).toBe(false)
    })

    it('при ошибке эмитит error и пробрасывает исключение', async () => {
      const service = AudioService.getInstance()

      currentAudio.play = vi.fn(async () => {
        throw new Error('NotAllowedError')
      })

      const errorHandler = vi.fn()
      service.on('error', errorHandler)

      await expect(service.play()).rejects.toThrow('NotAllowedError')
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'NotAllowedError' }),
      )
    })
  })

  describe('pause', () => {
    it('эмитит pause', () => {
      const service = AudioService.getInstance()
      const handler = vi.fn()
      service.on('pause', handler)

      service.pause()

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('seek', () => {
    it('клампит в [0, duration]', () => {
      const service = AudioService.getInstance()
      currentAudio.duration = 100

      service.seek(150)
      expect(currentAudio.currentTime).toBe(100)

      service.seek(-10)
      expect(currentAudio.currentTime).toBe(0)

      service.seek(50)
      expect(currentAudio.currentTime).toBe(50)
    })

    it('сбрасывает в 0, если duration невалидна', () => {
      const service = AudioService.getInstance()
      currentAudio.duration = NaN

      service.seek(50)
      expect(currentAudio.currentTime).toBe(0)
    })

    it('игнорирует NaN', () => {
      const service = AudioService.getInstance()
      currentAudio.duration = 100
      currentAudio.currentTime = 30

      service.seek(NaN)
      expect(currentAudio.currentTime).toBe(30)
    })
  })

  describe('volume', () => {
    it('клампит в [0, 1]', () => {
      const service = AudioService.getInstance()

      service.setVolume(1.5)
      expect(currentAudio.volume).toBe(1)

      service.setVolume(-0.5)
      expect(currentAudio.volume).toBe(0)

      service.setVolume(0.5)
      expect(currentAudio.volume).toBe(0.5)
    })
  })

  describe('on / off', () => {
    it('on возвращает unsubscribe-функцию', () => {
      const service = AudioService.getInstance()
      const handler = vi.fn()
      const unsub = service.on('play', handler)

      currentAudio.emit('play')
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()

      currentAudio.emit('play')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('listener не роняет emit при исключении', () => {
      // Заглушаем console.error — мы намеренно вызываем ошибку,
      // и её логирование создаёт шум в выводе тестов.
      // Проверяем, что лог действительно был, через spy.
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const service = AudioService.getInstance()
        const badHandler = vi.fn(() => {
          throw new Error('boom')
        })
        const goodHandler = vi.fn()

        service.on('play', badHandler)
        service.on('play', goodHandler)

        currentAudio.emit('play')

        expect(badHandler).toHaveBeenCalled()
        expect(goodHandler).toHaveBeenCalled()

        // Дополнительно: убеждаемся, что AudioService действительно залогировал ошибку
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('listener error on "play"'),
          expect.any(Error),
        )
      } finally {
        consoleErrorSpy.mockRestore()
      }
    })
  })

  describe('destroy', () => {
    it('обнуляет singleton', () => {
      const service = AudioService.getInstance()
      service.destroy()

      const newService = AudioService.getInstance()
      expect(newService).not.toBe(service)
    })

    it('снимает все слушатели', () => {
      const service = AudioService.getInstance()
      const handler = vi.fn()
      service.on('play', handler)

      service.destroy()

      expect(handler).not.toHaveBeenCalled()
    })
  })
})
