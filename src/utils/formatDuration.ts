// src/utils/formatDuration.ts

/**
 * Форматирует длительность в `m:ss`.
 * Возвращает `--:--`, если значение некорректно.
 */
export function formatDuration(sec: number | undefined | null): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '--:--'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
