// src/services/download/DownloadSpaceService.ts

import { get, set, del } from 'idb-keyval'
import { ref } from 'vue'

const SPACE_KEY = 'player:downloadSpace'

const PLUGIN_SUBDIR_PREFIX = 'cuei-'

class DownloadSpaceService {
  private static instance: DownloadSpaceService | null = null

  /** Корневая папка спейса */
  private spaceHandle: FileSystemDirectoryHandle | null = null

  /** Реактивный флаг: есть ли папка */
  readonly hasSpace = ref(false)

  /** Реактивное имя папки для UI */
  readonly spaceName = ref<string | null>(null)

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
      }
    } catch (err) {
      console.error('[download-space] failed to load', err)
    }
  }

  // --- Выбор папки ---------------------------------------------------

  /**
   * Выбор папки через showDirectoryPicker.
   * Сохраняет handle в IDB.
   */
  async pickSpace(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      this.spaceHandle = handle
      this.hasSpace.value = true
      this.spaceName.value = handle.name
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

  /**
   * Возвращает (и создаёт) подпапку для конкретного плагина.
   * Имя: 'cuei-{pluginId}'.
   */
  async getPluginDir(pluginId: string): Promise<FileSystemDirectoryHandle> {
    if (!this.spaceHandle) {
      throw new Error('[download-space] space not selected')
    }
    const subdirName = `${PLUGIN_SUBDIR_PREFIX}${pluginId}`
    return this.spaceHandle.getDirectoryHandle(subdirName, { create: true })
  }

  // --- Очистка -------------------------------------------------------

  async clear(): Promise<void> {
    this.spaceHandle = null
    this.hasSpace.value = false
    this.spaceName.value = null
    await del(SPACE_KEY)
  }
}

export const downloadSpaceService = DownloadSpaceService.getInstance()
