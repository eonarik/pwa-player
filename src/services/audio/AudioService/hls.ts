// src/services/audio/audioService/hls.ts

import Hls from 'hls.js';

/**
 * Контроллер HLS-воспроизведения.
 * Отвечает за создание/подключение/разрушение `hls.js` и обработку fatal-ошибок.
 */
export class HlsController {
  private hls: Hls | null = null;
  private failed = false;

  get isFailed(): boolean {
    return this.failed;
  }

  /**
   * Пытается воспроизвести HLS-поток. Если hls.js не поддерживается — возвращает false
   * (вызывающий должен откатиться на нативный <audio>).
   *
   * @param url — m3u8-URL
   * @param audio — HTMLAudioElement
   * @param onFatalError — коллбэк для передачи ошибки наружу
   * @returns true, если удалось инициализировать hls.js
   */
  tryAttach(url: string, audio: HTMLAudioElement, onFatalError: (message: string) => void): boolean {
    if (!Hls.isSupported()) return false;

    this.destroy(); // на случай повторного вызова

    this.hls = new Hls();
    this.hls.loadSource(url);
    this.hls.attachMedia(audio);

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      console.warn('[audio] HLS fatal error', data.type, data.details);

      this.failed = true;
      audio.pause();

      let message = 'Ошибка потока';
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        message = 'Не удалось загрузить поток (сеть или CORS)';
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        message = 'Ошибка воспроизведения медиа';
      } else {
        message = `Ошибка потока: ${data.details}`;
      }

      onFatalError(message);
    });

    return true;
  }

  reset(): void {
    this.failed = false;
  }

  destroy(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }
}
