// src/services/yandex/YandexDiskService.ts

import { authService } from '@/services/auth/AuthService'
import { compareStrings } from '@/utils/sort'

const PROXY_URL = (import.meta.env.VITE_DISK_PROXY_URL ?? '').replace(/\/+$/, '')

export interface YandexItem {
  path: string
  name: string
  type: 'dir' | 'file'
  size?: number
  mime_type?: string
  media_type?: string
  created?: string
  modified?: string
  isAudio?: boolean
}

export interface YandexResourcesResponse {
  path: string
  total: number
  items: YandexItem[]
}

export interface YandexConfig {
  hasSettings: boolean
  publicFolders: string[]
}

/** Специальная ошибка для 401 — UI показывает экран логина */
export class AuthRequiredError extends Error {
  constructor() {
    super('Authorization required')
    this.name = 'AuthRequiredError'
  }
}

export class YandexDiskService {
  private static instance: YandexDiskService | null = null

  static getInstance(): YandexDiskService {
    if (!YandexDiskService.instance) {
      YandexDiskService.instance = new YandexDiskService()
    }
    return YandexDiskService.instance
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${PROXY_URL}/api/health`)
      return res.ok
    } catch {
      return false
    }
  }

  async getConfig(): Promise<YandexConfig> {
    const res = await fetch(`${PROXY_URL}/api/config`)
    if (!res.ok) {
      throw new Error(`Failed to fetch config: HTTP ${res.status}`)
    }
    return res.json() as Promise<YandexConfig>
  }

  async listResources(path = '/'): Promise<YandexResourcesResponse> {
    const params = new URLSearchParams({ path })

    const response = await fetch(`${PROXY_URL}/api/disk/resources?${params.toString()}`, {
      headers: authService.authHeaders(),
    })

    if (response.status === 401) {
      throw new AuthRequiredError()
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      throw new Error(error.error ?? `HTTP ${response.status}`)
    }

    const data = (await response.json()) as YandexResourcesResponse
    data.items.sort((a, b) => compareStrings(a.name, b.name))
    return data
  }

  buildDownloadUrl(path: string): string {
    const params = new URLSearchParams({ path })
    const token = authService.getToken()
    if (token) params.set('token', token)
    return `${PROXY_URL}/api/disk/download?${params.toString()}`
  }

  /**
   * Ищет обложку трека через прокси (Deezer → iTunes fallback).
   * Возвращает URL обложки или null.
   */
  async getCover(artist: string, title: string): Promise<string | null> {
    if (!title) return null // title обязателен

    try {
      const params = new URLSearchParams({ title })
      // Не отправляем artist, если это фолбэк "Yandex Disk"
      if (artist && artist !== 'Yandex Disk') {
        params.set('artist', artist)
      }

      const res = await fetch(`${PROXY_URL}/api/cover?${params.toString()}`)

      if (!res.ok) return null

      const data = (await res.json()) as { coverUrl: string | null }
      return data.coverUrl
    } catch (err) {
      console.warn(`[yandex] failed to fetch cover for "${artist} - ${title}"`, err)
      return null
    }
  }
}

export const yandexDiskService = YandexDiskService.getInstance()
