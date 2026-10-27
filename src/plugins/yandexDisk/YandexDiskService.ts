// src/plugins/yandexDisk/YandexDiskService.ts
import { compareStrings } from '@/utils/sort'
import { apiClient, type AuthProvider } from '@/services/api/ApiClient'
import type { YandexResourcesResponse, YandexResourceItem } from './types'

const PROXY_URL = ''
const REQUEST_TIMEOUT_MS = 10_000
const DISCONNECTED_KEY = 'yandex-disconnected'
const CONNECTED_KEY = 'yandex-connected'

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

export class YandexDiskService implements AuthProvider {
  readonly id = 'yandex'
  readonly healthUrl = '/api/auth/me'

  private static instance: YandexDiskService | null = null

  private constructor() {
    apiClient.registerProvider(this)
  }

  static getInstance(): YandexDiskService {
    if (!YandexDiskService.instance) {
      YandexDiskService.instance = new YandexDiskService()
    }
    return YandexDiskService.instance
  }

  // --- AuthProvider ----------------------------------------------------

  isAccessValid(): boolean {
    return true // Cookie-based, JS не видит
  }

  hasRefreshToken(): boolean {
    return false // Refresh на сервере
  }

  async refreshAccess(): Promise<boolean> {
    return false
  }

  getAuthHeaders(): Record<string, string> {
    return {}
  }

  // --- IYandexService --------------------------------------------------

  isDisconnected(): boolean {
    if (localStorage.getItem(DISCONNECTED_KEY) === 'true') return true

    // Если нет флага подключения, считаем отключенным
    return localStorage.getItem(CONNECTED_KEY) !== 'true'
  }

  setDisconnected(val: boolean) {
    if (val) {
      localStorage.setItem(DISCONNECTED_KEY, 'true')
      localStorage.removeItem(CONNECTED_KEY)
    } else {
      localStorage.removeItem(DISCONNECTED_KEY)
      localStorage.setItem(CONNECTED_KEY, 'true')
    }
  }

  setConnected(val: boolean) {
    if (val) localStorage.setItem(CONNECTED_KEY, 'true')
    else localStorage.removeItem(CONNECTED_KEY)
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

  async listResources(path = '/'): Promise<YandexResourcesResponse> {
    const params = new URLSearchParams({ path })

    try {
      const response = await fetch(`${PROXY_URL}/api/disk/resources?${params.toString()}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

      const data = (await response.json()) as YandexResourcesResponse & {
        items?: YandexResourceItem[]
      }
      const items = data.items || data._embedded?.items || []
      items.sort((a, b) => compareStrings(a.name, b.name))

      return { ...data, items, total: items.length }
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
    return `${PROXY_URL}/api/disk/download?${params.toString()}`
  }

  async readTextFile(remotePath: string): Promise<TextFileResponse | null> {
    const params = new URLSearchParams({ path: remotePath })

    try {
      const res = await fetch(`${PROXY_URL}/api/disk/text?${params.toString()}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

  async writeTextFile(remotePath: string, content: string): Promise<WriteTextFileResponse> {
    const params = new URLSearchParams({ path: remotePath })

    const res = await fetch(`${PROXY_URL}/api/disk/text?${params.toString()}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
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

  async checkSession(): Promise<'ok' | 'expired' | 'unavailable'> {
    try {
      const res = await fetch(`${PROXY_URL}/api/auth/me`, {
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      })
      if (res.status === 401) return 'expired'
      if (!res.ok) return 'unavailable'
      const data = (await res.json()) as { authenticated: boolean }
      return data.authenticated ? 'ok' : 'expired'
    } catch {
      return 'unavailable'
    }
  }
}

export const yandexDiskService = YandexDiskService.getInstance()
