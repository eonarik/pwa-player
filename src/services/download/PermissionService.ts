// src/services/download/PermissionService.ts

import { ref } from 'vue'

export type PermissionState = 'granted' | 'prompt' | 'denied'

/**
 * Проверяет права на чтение/запись папки.
 * Возвращает текущее состояние без запроса.
 */
export async function queryPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<PermissionState> {
  try {
    return (await handle.queryPermission({ mode })) as PermissionState
  } catch (err) {
    console.warn('[permission] queryPermission failed', err)
    return 'prompt'
  }
}

/**
 * Запрашивает права на папку.
 * ВАЖНО: должен вызываться внутри user gesture (клик).
 * Иначе браузер отклонит запрос.
 */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<PermissionState> {
  try {
    return (await handle.requestPermission({ mode })) as PermissionState
  } catch (err) {
    console.warn('[permission] requestPermission failed', err)
    return 'denied'
  }
}

/**
 * Проверяет, что права есть. Если нет — возвращает false.
 * Не запрашивает.
 */
export async function hasPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  return (await queryPermission(handle, mode)) === 'granted'
}

/**
 * Реактивное состояние: требуется ли запрос прав.
 * Используется UI, чтобы показать баннер «Восстановить доступ».
 */
export const permissionNeeded = ref(false)
