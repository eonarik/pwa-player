// src/services/library/migrations.ts

import type { FileLocation, ScanState } from '@/types/library'

/**
 * Миграция старых кешей: `origin: 'remote' | 'downloaded' | 'only-local' | undefined`
 * → `fileLocation`.
 *
 * - `'downloaded'` → `'both'`
 * - `'only-local'` → `'local-only'`
 * - `'remote'` / `undefined` → `'remote-only'`
 *
 * Используется в `fromPersisted` (чтение старых кешей). Новый код
 * `origin` не пишет, поэтому миграция нужна только при чтении.
 * TODO(v1.0.0): Удалить этот файл вместе со SCHEMA_VERSION 4.
 */
export function migrateFileLocation(
  origin: 'remote' | 'downloaded' | 'only-local' | undefined | null,
): FileLocation {
  if (origin === 'downloaded') return 'both'
  if (origin === 'only-local') return 'local-only'
  return 'remote-only'
}

/**
 * Миграция старых кешей: `scanStatus: 'scanned' | 'scanning' | undefined`
 * → `scanState`.
 *
 * Используется в `fromPersisted` (чтение старых кешей).
 */
export function migrateScanState(scanStatus: 'scanned' | 'scanning' | undefined | null): ScanState {
  if (scanStatus === 'scanned') return 'scanned'
  if (scanStatus === 'scanning') return 'scanning'
  return 'pending'
}
