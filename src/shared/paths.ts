// src/shared/paths.ts

/**
 * Нормализует путь для Яндекс.Диска (self-плагин).
 *
 * - убирает префикс `disk:`
 * - убирает ведущие слэши
 * - пустой путь → `/`
 *
 * Не путать с `normalizeClientPath` на бэкенде
 * (`server/src/shared/paths.js`) — та схлопывает `.` и `..`
 * и используется плагином `yandex` для безопасного преобразования
 * клиентского пути в `app:/...`.
 */
export function cleanDiskPath(path: string): string {
  return path.replace(/^disk:/, '').replace(/^\/+/, '') || '/'
}
