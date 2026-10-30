// src/services/folders/types.ts

/**
 * Статус сканирования папки.
 *
 * - `pending`  — папка известна, но содержимое ещё не загружалось.
 *                Клик по папке должен запустить скан (1 уровень).
 * - `scanning` — скан идёт прямо сейчас. Play заблокирован, показываем лоадер.
 * - `scanned`  — папка и её поддерево отсканированы. Play разрешён.
 * - `error`    — скан упал. Показываем «Обновить» / «Ошибка синхронизации».
 */
export type FolderScanStatus = 'pending' | 'scanning' | 'scanned' | 'error';

/**
 * Запись в сервисе статусов. Хранится в localStorage per-folder.
 * Не привязана к конкретному плагину — id папки уже уникален.
 */
export interface FolderStatusEntry {
  status: FolderScanStatus;
  /** Когда статус последний раз менялся (unix ms). */
  updatedAt: number;
  /** Сообщение об ошибке (только для status='error'). */
  errorMessage?: string;
}
