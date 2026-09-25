// src/services/audio/AudioService.ts

import type { AudioEventMap, AudioEventName, AudioListener } from './types'

export class AudioService {
  private static instance: AudioService | null = null

  private audio: HTMLAudioElement
  private listeners: {
    [K in AudioEventName]?: Set<AudioListener<K>>
  } = {}

  // Храним ссылки на нативные хендлеры, чтобы снять их при destroy()
  private nativeHandlers: Array<{
    event: string
    handler: EventListener
  }> = []

  private currentObjectUrl: string | null = null

  private constructor() {
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.bindNativeEvents()
  }

  /** Singleton — везде используем AudioService.getInstance() */
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

    // Возвращаем unsubscribe-функцию — удобно для onUnmounted
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

  /**
   * Загружает трек.
   * @param source — URL, File или Blob
   */
  load(source: string | File | Blob): void {
    // Чистим предыдущий objectURL, если был
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }

    if (typeof source === 'string') {
      this.audio.src = source
    } else {
      this.currentObjectUrl = URL.createObjectURL(source)
      this.audio.src = this.currentObjectUrl
    }

    this.audio.load()
  }

  /**
   * Полная выгрузка текущего источника.
   * Останавливает воспроизведение, ревокает objectURL, снимает src.
   */
  unload(): void {
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl)
      this.currentObjectUrl = null
    }
  }

  // --- Управление воспроизведением -------------------------------------

  async play(): Promise<void> {
    try {
      await this.audio.play()
    } catch (err) {
      // play() отклоняется, если пользователь не взаимодействовал со страницей
      // или формат не поддерживается. Не глотаем ошибку молча.
      const message = err instanceof Error ? err.message : 'Unknown play() error'
      this.emit('error', { message })
      throw err
    }
  }

  pause(): void {
    this.audio.pause()
  }

  toggle(): Promise<void> | void {
    if (this.audio.paused) return this.play()
    this.pause()
  }

  seek(time: number): void {
    if (!Number.isFinite(time)) return
    const duration = this.audio.duration
    if (!Number.isFinite(duration) || duration <= 0) {
      this.audio.currentTime = 0
      return
    }
    // Клампим в [0, duration], чтобы не ловить InvalidStateError
    this.audio.currentTime = Math.min(Math.max(time, 0), duration)
  }

  seekBy(delta: number): void {
    this.seek(this.audio.currentTime + delta)
  }

  // --- Громкость --------------------------------------------------------

  setVolume(value: number): void {
    // HTMLAudioElement.volume принимает только [0, 1]
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

    // error — отдельно, потому что payload собирается из MediaError
    const errorHandler: EventListener = () => {
      const mediaError = this.audio.error
      this.emit('error', {
        message: mediaError?.message || 'Media error',
        code: mediaError?.code,
      })
    }
    this.audio.addEventListener('error', errorHandler)
    this.nativeHandlers.push({ event: 'error', handler: errorHandler })
  }

  // --- Очистка ресурсов -------------------------------------------------

  destroy(): void {
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
