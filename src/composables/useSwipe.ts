// src/composables/useSwipe.ts

import type { Ref } from 'vue';

export interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Минимальное смещение по X (px), чтобы считать жест свайпом. По умолчанию 50. */
  threshold?: number;
  /** Если задано — свайп обрабатывается только при `true`. */
  enabled?: Ref<boolean> | (() => boolean);
}

export interface UseSwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

/**
 * Простой горизонтальный свайп без preview.
 *
 * `onTouchStart`/`onTouchMove` только определяют направление (горизонтальный
 * или вертикальный жест). На `onTouchEnd` — если горизонтальный жест и
 * смещение больше `threshold` — вызывается `onSwipeLeft`/`onSwipeRight`.
 *
 * Не вызывает `preventDefault`: вертикальный скролл не блокируется. Чтобы
 * браузер не пытался горизонтально скроллить контейнер, на нём должен быть
 * `touch-action: pan-y`.
 */
export function useSwipe(options: UseSwipeOptions): UseSwipeHandlers {
  const threshold = options.threshold ?? 50;
  let startX = 0;
  let startY = 0;
  let isHorizontal: boolean | null = null;

  function isEnabled(): boolean {
    if (!options.enabled) return true;
    return typeof options.enabled === 'function' ? options.enabled() : options.enabled.value;
  }

  function onTouchStart(e: TouchEvent): void {
    if (!isEnabled()) return;
    const t = e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
    isHorizontal = null;
  }

  function onTouchMove(e: TouchEvent): void {
    if (!isEnabled() || isHorizontal !== null) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > 10 || dy > 10) {
      isHorizontal = dx > dy;
    }
  }

  function onTouchEnd(e: TouchEvent): void {
    if (!isEnabled()) return;
    if (isHorizontal === false) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dx) < dy) return;
    if (dx < 0) options.onSwipeLeft?.();
    else options.onSwipeRight?.();
  }

  return { onTouchStart, onTouchMove, onTouchEnd };
}
