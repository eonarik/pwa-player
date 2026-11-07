// src/plugins/yandexSelf/logii/authorColor.ts

import { simpleHash } from '@/utils/hash';

/**
 * Возвращает hue (0..359) из имени автора.
 * Детерминированно: одно имя → один цвет навсегда.
 */
export function hashToHue(name: string): number {
  const hash = simpleHash(name);
  // Берём младшие 4 hex-символа (16 бит) — достаточно для диапазона.
  const n = parseInt(hash.slice(-4) || '0', 16);
  return n % 360;
}

/**
 * Цвет аватара автора. Используется для фона круглого аватара
 * в LogiiAuthorsColumn. Насыщенность/светлота фиксированы, чтобы
 * читался белый текст при любом hue.
 */
export function authorAvatarColor(name: string): string {
  return `hsl(${hashToHue(name)}, 60%, 45%)`;
}
