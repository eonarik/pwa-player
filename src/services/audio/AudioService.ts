// src/services/audio/AudioService.ts

import Hls from 'hls.js'
import type { AudioEventMap, AudioEventName, AudioListener } from './types'

export class AudioService {
  private static instance: AudioService | null = null

  private audio: HTMLAudioElement
  private hls: Hls | null = null
  private hlsFailed = false
  private listeners: {
    [K in AudioEventName]?: Set<AudioListener<K>>
  } = {}

  private nativeHandlers: Array<{
    event: string
    handler: EventListener
  }> = []

  private currentObjectUrl: string | null = null
  private currentSrc: string | null = null

  private constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.bindNativeEvents()
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService()
    }
    return AudioService.instance
  }

  // --- Подписка на события ---------------------------------------------

  on<K extends AudioEventName>(event: K, listener: AudioListener<K>): () => void {
    if (!this.listeners[event]) {
      // @ts-expect-error — TS не выводит Set<AudioListener<K>> для mapped-типа
      this.listeners[event] = new Set()
    }
    this.listeners[event].add(listener)

    return () => this.off(event, listener)
  }

  off<K extends AudioEventName>(event: K, listener: AudioListener<K>): void {
    this.listeners[event]?.delete(listener)
  }

  private emit<K extends AudioEventName>(event: K, payload: AudioEventMap[K]): void {
    this.listeners[event]?.forEach((listener) => {
      try {
        listener(payload)
      } catch (err) {
        console.error(`[AudioService] listener error on "${event}"`, err)
      }
    })
  }

  // --- Загрузка источника ----------------------------------------------

  load(source: string | File | Blob): void {
    this.destroyHls()
    this.hlsFailed = false

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }

    if (typeof source === 'string') {
      this.currentSrc = source

      if (source.includes('.m3u8') && Hls.isSupported()) {
        this.hls = new Hls()
        this.hls.loadSource(source)
        this.hls.attachMedia(this.audio)

        this.hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return

          console.warn('[audio] HLS fatal error', data.type, data.details)

          this.hlsFailed = true
          this.pause()

          let message = 'Ошибка потока'
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            message = 'Не удалось загрузить поток (сеть или CORS)'
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            message = 'Ошибка воспроизведения медиа'
          } else {
            message = `Ошибка потока: ${data.details}`
          }

          this.emit('error', { message, src: source })
        })
      } else {
        this.audio.src = source
        this.audio.load()
      }
    } else {
      this.currentSrc = null
      this.currentObjectUrl = URL.createObjectURL(source)
      this.audio.src = this.currentObjectUrl
      this.audio.load()
    }
  }

  unload(): void {
    this.destroyHls()
    this.hlsFailed = false
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }
    this.currentSrc = null
  }

  private destroyHls(): void {
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
  }

  // --- Управление воспроизведением -------------------------------------

  async play(): Promise<void> {
    if (this.hlsFailed && this.currentSrc) {
      this.load(this.currentSrc)
    }

    try {
      await this.audio.play()
      if (this.audio.paused) {
        this.emit('pause', undefined as void)
      }
    } catch (err) {
      // Если play() был прерван нашим же pause() (HLS fatal error, race) —
      // это ожидаемое поведение, не считаем ошибкой.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }

      const message = err instanceof Error ? err.message : 'Unknown play() error'
      console.error('[audio] play() rejected', err)
      this.emit('error', { message, src: this.audio.src })
      this.emit('pause', undefined as void)
      throw err
    }
  }

  pause(): void {
    this.audio.pause()
    // Вручную эмитим pause на случай, если нативный event не сработал (например, при race condition с HLS).
    this.emit('pause', undefined as void)
  }

  toggle(): Promise<void> | void {
    if (this.audio.paused) return this.play()
    this.pause()
  }

  seek(time: number): void {
    if (!Number.isFinite(time)) return
    const duration = this.audio.duration

    if (Number.isFinite(duration) && duration > 0) {
      this.audio.currentTime = Math.min(Math.max(time, 0), duration)
    } else {
      this.audio.currentTime = Math.max(time, 0)
    }
  }

  seekBy(delta: number): void {
    this.seek(this.audio.currentTime + delta)
  }

  // --- Громкость --------------------------------------------------------

  setVolume(value: number): void {
    this.audio.volume = Math.min(Math.max(value, 0), 1)
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted
  }

  // --- Геттеры состояния ------------------------------------------------

  get element(): HTMLAudioElement {
    return this.audio
  }

  get currentTime(): number {
    return this.audio.currentTime
  }

  get duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0
  }

  get paused(): boolean {
    return this.audio.paused
  }

  get volume(): number {
    return this.audio.volume
  }

  get muted(): boolean {
    return this.audio.muted
  }

  get src(): string {
    return this.audio.src
  }

  get isLive(): boolean {
    return !Number.isFinite(this.audio.duration)
  }

  // --- Привязка нативных событий ---------------------------------------

  private bindNativeEvents(): void {
    const bind = <K extends AudioEventName>(
      nativeEvent: string,
      emitName: K,
      map: () => AudioEventMap[K],
    ) => {
      const handler: EventListener = () => {
        this.emit(emitName, map())
      }
      this.audio.addEventListener(nativeEvent, handler)
      this.nativeHandlers.push({ event: nativeEvent, handler })
    }

    bind('timeupdate', 'timeupdate', () => ({
      currentTime: this.currentTime,
      duration: this.duration,
    }))

    bind('loadedmetadata', 'loadedmetadata', () => ({
      duration: this.duration,
    }))

    bind('play', 'play', () => undefined as void)
    bind('pause', 'pause', () => undefined as void)
    bind('ended', 'ended', () => undefined as void)
    bind('waiting', 'waiting', () => undefined as void)
    bind('canplay', 'canplay', () => undefined as void)

    bind('volumechange', 'volumechange', () => ({
      volume: this.volume,
      muted: this.muted,
    }))

    const errorHandler: EventListener = () => {
      const mediaError = this.audio.error
      this.emit('error', {
        message: mediaError?.message || 'Media error',
        code: mediaError?.code,
        src: this.audio.src,
      })
    }
    this.audio.addEventListener('error', errorHandler)
    this.nativeHandlers.push({ event: 'error', handler: errorHandler })
  }

  // --- Очистка ресурсов -------------------------------------------------

  destroy(): void {
    this.destroyHls()
    this.audio.pause()

    this.nativeHandlers.forEach(({ event, handler }) => {
      this.audio.removeEventListener(event, handler)
    })
    this.nativeHandlers = []

    Object.values(this.listeners).forEach((set) => set?.clear())
    this.listeners = {}

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }

    this.audio.removeAttribute('src')
    this.audio.load()

    AudioService.instance = null
  }
}

export const audioService = AudioService.getInstance()
