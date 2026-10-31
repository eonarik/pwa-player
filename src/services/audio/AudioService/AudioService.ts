// src/services/audio/audioService/AudioService.ts

import type { AudioEventMap, AudioEventName, AudioListener } from '../types';
import { HlsController } from './hls';
import { ResourceHolder } from './resources';
import { bindNativeEvents, type NativeEventHandlers } from './events';

export class AudioService {
  private static instance: AudioService | null = null;

  private audio: HTMLAudioElement;
  private hls: HlsController;
  private resources: ResourceHolder;
  private nativeEvents: NativeEventHandlers;

  private listeners: {
    [K in AudioEventName]?: Set<AudioListener<K>>;
  } = {};

  private currentSrc: string | null = null;

  private constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.hls = new HlsController();
    this.resources = new ResourceHolder();
    this.nativeEvents = bindNativeEvents(this.audio, (event, payload) => this.emit(event, payload));
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  on<K extends AudioEventName>(event: K, listener: AudioListener<K>): () => void {
    if (!this.listeners[event]) {
      // @ts-expect-error — TS не выводит Set<AudioListener<K>> для mapped-типа
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(listener);

    return () => this.off(event, listener);
  }

  off<K extends AudioEventName>(event: K, listener: AudioListener<K>): void {
    this.listeners[event]?.delete(listener);
  }

  private emit<K extends AudioEventName>(event: K, payload: AudioEventMap[K]): void {
    this.listeners[event]?.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[AudioService] listener error on "${event}"`, err);
      }
    });
  }

  load(source: string | File | Blob): void {
    this.hls.destroy();
    this.hls.reset();
    this.resources.releaseInternal();

    if (typeof source === 'string') {
      this.currentSrc = source;

      if (source.includes('.m3u8')) {
        const attached = this.hls.tryAttach(source, this.audio, (message) => {
          this.emit('error', { message, src: source });
          this.pause();
        });
        if (!attached) {
          // hls.js не поддерживается — нативный <audio>
          this.audio.src = source;
          this.audio.load();
        }
      } else {
        this.audio.src = source;
        this.audio.load();
      }
    } else {
      this.currentSrc = null;
      const file = source instanceof File ? source : null;
      const url = URL.createObjectURL(source);
      this.resources.setObjectUrl(url, file);
      this.audio.src = url;
      this.audio.load();
    }
  }

  unload(): void {
    this.hls.destroy();
    this.hls.reset();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();

    this.resources.releaseInternal();
    this.currentSrc = null;
  }

  /**
   * Освобождает текущий File/objectURL и сбрасывает src.
   * Идемпотентен. Используется при отключении плагина, dispose, unload.
   *
   * В отличие от `unload`, не дёргает `hls.destroy()` (HLS разрушим отдельно).
   */
  releaseCurrent(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();

    this.resources.releaseInternal();
    this.currentSrc = null;
  }

  async play(): Promise<void> {
    if (this.hls.isFailed) {
      throw new Error('HLS stream failed');
    }

    try {
      await this.audio.play();
      if (this.audio.paused) {
        this.emit('pause', undefined as void);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      const message = err instanceof Error ? err.message : 'Unknown play() error';
      console.error('[audio] play() rejected', err);
      this.emit('error', { message, src: this.audio.src });
      this.emit('pause', undefined as void);
      throw err;
    }
  }

  pause(): void {
    this.audio.pause();
    this.emit('pause', undefined as void);
  }

  toggle(): Promise<void> | void {
    if (this.audio.paused) return this.play();
    this.pause();
  }

  seek(time: number): void {
    if (!Number.isFinite(time)) return;
    const duration = this.audio.duration;

    if (Number.isFinite(duration) && duration > 0) {
      this.audio.currentTime = Math.min(Math.max(time, 0), duration);
    } else {
      this.audio.currentTime = Math.max(time, 0);
    }
  }

  seekBy(delta: number): void {
    this.seek(this.audio.currentTime + delta);
  }

  setVolume(value: number): void {
    this.audio.volume = Math.min(Math.max(value, 0), 1);
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  get element(): HTMLAudioElement {
    return this.audio;
  }

  get currentTime(): number {
    return this.audio.currentTime;
  }

  get duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  get paused(): boolean {
    return this.audio.paused;
  }

  get volume(): number {
    return this.audio.volume;
  }

  get muted(): boolean {
    return this.audio.muted;
  }

  get src(): string {
    return this.audio.src;
  }

  get isLive(): boolean {
    return !Number.isFinite(this.audio.duration);
  }

  destroy(): void {
    this.hls.destroy();
    this.audio.pause();

    this.nativeEvents.dispose();

    Object.values(this.listeners).forEach((set) => set?.clear());
    this.listeners = {};

    this.resources.releaseInternal();
    this.currentSrc = null;

    this.audio.removeAttribute('src');
    this.audio.load();

    AudioService.instance = null;
  }
}
