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
 * Проблемы, найденные при сканировании папки скачивания.
 * Используется для модалки «Проблемные треки».
 */
export interface SyncIssues {
  pluginId: string
  onlyLocal: Array<{ relativePath: string; filename: string }>
  /** trackIds треков, которые помечены downloaded, но файла нет */
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
