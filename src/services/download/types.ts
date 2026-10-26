// src/services/download/types.ts

/**
 * Состояние процесса скачивания конкретного трека.
 */
export interface TrackDownloadState {
  trackId: string
  written: number
  total: number
  /** AbortController для отмены */
  abort: AbortController
}

/**
 * Ошибка скачивания (с HTTP-статусом).
 * Позволяет отличить битый файл (404) от сетевой ошибки (502/500).
 */
export class DownloadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'DownloadError'
  }
}

/**
 * Проблемы, найденные при сканировании папки скачивания.
 */
export interface SyncIssues {
  /** Плагин, у которого нашли проблемы */
  pluginId: string
  /** Новые треки, которых нет в библиотеке */
  onlyLocal: Array<{ relativePath: string; filename: string }>
  /** Треки в библиотеке, файлы которых не найдены */
  missing: string[]
}

/**
 * Отчёт о завершённой синхронизации.
 */
export interface SyncReport {
  pluginId: string
  downloaded: number
  onlyLocalCount: number
  missingCount: number
  issues: SyncIssues | null
}

/**
 * Выбор пользователя в модалке «Проблемные треки».
 */
export interface SelectedIssues {
  /** Отмеченные файлы для добавления как only-local */
  onlyLocal: Array<{ pluginId: string; relativePath: string; filename: string }>
  /** Отмеченные треки для пометки как remote */
  missing: Array<{ pluginId: string; trackId: string }>
}
