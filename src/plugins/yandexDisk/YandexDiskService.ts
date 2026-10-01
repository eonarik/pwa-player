// src/plugins/yandexDisk/YandexDiskService.ts

import { authService } from '@/services/auth/AuthService'
import { compareStrings } from '@/utils/sort'
import type { YandexConfig, YandexResourcesResponse } from './types'

const PROXY_URL = (import.meta.env.VITE_DISK_PROXY_URL ?? '').replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 10_000

export class AuthRequiredError extends Error {
  constructor() {
    super('Authorization required')
    this.name = 'AuthRequiredError'
  }
}

export interface TextFileResponse {
  content: string
  modified: string | null
  size: number | null
}

export interface WriteTextFileResponse {
  ok: boolean
  modified: string | null
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
      const res = await fetch(`${PROXY_URL}/api/health`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async getConfig(): Promise<YandexConfig> {
    const res = await fetch(`${PROXY_URL}/api/config`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch config: HTTP ${res.status}`)
    }
    return res.json() as Promise<YandexConfig>
  }

  async listResources(path = '/'): Promise<YandexResourcesResponse> {
    const params = new URLSearchParams({ path })

    try {
      const response = await fetch(`${PROXY_URL}/api/disk/resources?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new Error(`Таймаут запроса к Диску: ${path}`)
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error(`Сервер недоступен: ${path}`)
      }
      throw err
    }
  }

  buildDownloadUrl(path: string): string {
    const params = new URLSearchParams({ path })
    const token = authService.getToken()
    if (token) params.set('token', token)
    return `${PROXY_URL}/api/disk/download?${params.toString()}`
  }

  // --- Текстовые файлы -------------------------------------------------

  /**
   * Читает текстовый файл с Диска.
   * Возвращает содержимое или null, если файл недоступен.
   */
  async readTextFile(remotePath: string): Promise<TextFileResponse | null> {
    const params = new URLSearchParams({ path: remotePath })

    try {
      const res = await fetch(`${PROXY_URL}/api/disk/text?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: authService.authHeaders(),
      })

      if (res.status === 401) {
        throw new AuthRequiredError()
      }
      if (!res.ok) return null

      return (await res.json()) as TextFileResponse
    } catch (err) {
      console.error(`[yandex] readTextFile failed for "${remotePath}"`, err)
      return null
    }
  }

  /**
   * Записывает содержимое в текстовый файл на Диске.
   * Перезаписывает существующий файл.
   */
  async writeTextFile(remotePath: string, content: string): Promise<WriteTextFileResponse> {
    const params = new URLSearchParams({ path: remotePath })

    const res = await fetch(`${PROXY_URL}/api/disk/text?${params.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.authHeaders(),
      },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (res.status === 401) {
      throw new AuthRequiredError()
    }

    if (!res.ok) {
      const error = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      throw new Error(error.error ?? `HTTP ${res.status}`)
    }

    return (await res.json()) as WriteTextFileResponse
  }
}

export const yandexDiskService = YandexDiskService.getInstance()
