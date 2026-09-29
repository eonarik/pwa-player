// src/services/download/DownloadSpaceService.ts

import { get, set, del } from 'idb-keyval'
import { ref } from 'vue'
import { queryPermission, requestPermission, type PermissionState } from './PermissionService'

const SPACE_KEY = 'player:downloadSpace'

const PLUGIN_SUBDIR_PREFIX = 'cuei-'

class DownloadSpaceService {
  private static instance: DownloadSpaceService | null = null

  private spaceHandle: FileSystemDirectoryHandle | null = null

  readonly hasSpace = ref(false)
  readonly spaceName = ref<string | null>(null)

  /**
   * Требуется ли восстановление прав на папку.
   * true — если handle есть, но queryPermission !== 'granted'.
   */
  readonly needsPermission = ref(false)

  static getInstance(): DownloadSpaceService {
    if (!DownloadSpaceService.instance) {
      DownloadSpaceService.instance = new DownloadSpaceService()
    }
    return DownloadSpaceService.instance
  }

  // --- Загрузка из IDB -----------------------------------------------

  async load(): Promise<void> {
    try {
      const saved = await get<FileSystemDirectoryHandle>(SPACE_KEY)
      if (saved) {
        this.spaceHandle = saved
        this.hasSpace.value = true
        this.spaceName.value = saved.name
        await this.refreshPermissionState()
      }
    } catch (err) {
      console.error('[download-space] failed to load', err)
    }
  }

  // --- Выбор папки ---------------------------------------------------

  async pickSpace(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      this.spaceHandle = handle
      this.hasSpace.value = true
      this.spaceName.value = handle.name
      this.needsPermission.value = false
      await set(SPACE_KEY, handle)
      return handle
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      throw err
    }
  }

  // --- Доступ --------------------------------------------------------

  getSpace(): FileSystemDirectoryHandle | null {
    return this.spaceHandle
  }

  async getPluginDir(pluginId: string): Promise<FileSystemDirectoryHandle> {
    if (!this.spaceHandle) {
      throw new Error('[download-space] space not selected')
    }
    const subdirName = `${PLUGIN_SUBDIR_PREFIX}${pluginId}`
    return this.spaceHandle.getDirectoryHandle(subdirName, { create: true })
  }

  // --- Права ---------------------------------------------------------

  /**
   * Проверяет права на папку. Обновляет `needsPermission`.
   * Не запрашивает — только читает состояние.
   */
  async refreshPermissionState(): Promise<void> {
    if (!this.spaceHandle) {
      this.needsPermission.value = false
      return
    }
    const state = await queryPermission(this.spaceHandle, 'readwrite')
    this.needsPermission.value = state !== 'granted'
  }

  /**
   * Запрашивает права на папку.
   * ВАЖНО: должен вызываться внутри user gesture (клик).
   *
   * Если granted — обновляет состояние и возвращает 'granted'.
   * Если denied — не сбрасывает handle, но возвращает 'denied'.
   */
  async requestAccess(): Promise<PermissionState> {
    if (!this.spaceHandle) return 'denied'

    const state = await requestPermission(this.spaceHandle, 'readwrite')
    this.needsPermission.value = state !== 'granted'
    return state
  }

  // --- Очистка -------------------------------------------------------

  async clear(): Promise<void> {
    this.spaceHandle = null
    this.hasSpace.value = false
    this.spaceName.value = null
    this.needsPermission.value = false
    await del(SPACE_KEY)
  }
}

export const downloadSpaceService = DownloadSpaceService.getInstance()
