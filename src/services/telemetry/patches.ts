// src/services/telemetry/patches.ts

import {
  incBlobsCreated,
  incBlobsRevoked,
  incTimers,
  decTimers,
  incListeners,
  decListeners,
  incRaf,
  decRaf,
} from './counters';

/**
 * Патчим глобальные API, чтобы считать активные ресурсы.
 * Вызывать ОДИН раз при старте телеметрии. Идемпотентно.
 *
 * Риск: может сломать тонкий код (HLS, Vue). Поэтому включается
 * только при VITE_TELEMETRY === 'true'.
 */

let installed = false;

const orig = {
  createObjectURL: URL.createObjectURL.bind(URL),
  revokeObjectURL: URL.revokeObjectURL.bind(URL),
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  clearInterval: window.clearInterval.bind(window),
  addEventListener: EventTarget.prototype.addEventListener,
  removeEventListener: EventTarget.prototype.removeEventListener,
  raf: window.requestAnimationFrame.bind(window),
  cancelRaf: window.cancelAnimationFrame.bind(window),
};

// Чтобы отличать свои таймеры от чужих (например, от setTimeout с 0)
// мы храним id → активен.
const activeTimeouts = new Set<number>();
const activeIntervals = new Set<number>();
const activeRafs = new Set<number>();

export function installPatches(): void {
  if (installed) return;
  installed = true;

  // --- Blob URLs ---
  URL.createObjectURL = (obj: Blob | MediaSource) => {
    const url = orig.createObjectURL(obj);
    incBlobsCreated();
    return url;
  };

  URL.revokeObjectURL = (url: string) => {
    incBlobsRevoked();
    return orig.revokeObjectURL(url);
  };

  // --- Timers ---
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = orig.setTimeout(() => {
      activeTimeouts.delete(id);
      decTimers();
      if (typeof handler === 'function') handler(...args);
    }, timeout);
    activeTimeouts.add(id);
    incTimers();
    return id;
  }) as typeof window.setTimeout;

  window.clearTimeout = ((id?: number) => {
    if (id !== undefined && activeTimeouts.has(id)) {
      activeTimeouts.delete(id);
      decTimers();
    }
    return orig.clearTimeout(id);
  }) as typeof window.clearTimeout;

  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = orig.setInterval(handler as never, timeout, ...args);
    activeIntervals.add(id);
    incTimers();
    return id;
  }) as typeof window.setInterval;

  window.clearInterval = ((id?: number) => {
    if (id !== undefined && activeIntervals.has(id)) {
      activeIntervals.delete(id);
      decTimers();
    }
    return orig.clearInterval(id);
  }) as typeof window.clearInterval;

  // --- Event listeners ---
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener) incListeners();
    return orig.addEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    if (listener) decListeners();
    return orig.removeEventListener.call(this, type, listener, options);
  };

  // --- requestAnimationFrame ---
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = orig.raf((time) => {
      activeRafs.delete(id);
      decRaf();
      cb(time);
    });
    activeRafs.add(id);
    incRaf();
    return id;
  };

  window.cancelAnimationFrame = (id: number) => {
    if (activeRafs.has(id)) {
      activeRafs.delete(id);
      decRaf();
    }
    return orig.cancelRaf(id);
  };
}
