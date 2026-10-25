// src/plugins/yandexSelf/YandexSelfService.ts

import type {
  IYandexService,
  YandexResourcesResponse,
  YandexTextResponse,
  YandexWriteResponse,
} from '../yandexDisk/types'
import { cleanDiskPath } from '@/shared/paths'
import { apiClient, type AuthProvider } from '@/services/api/ApiClient'

const API_URL = '/api/yandex-self'
const ACCESS_KEY = 'yandex-self-access'
const REFRESH_KEY = 'yandex-self-refresh'
const DISCONNECTED_KEY = 'yandex-self-disconnected'

export class YandexSelfService implements IYandexService, AuthProvider {
  readonly id = 'yandex-self'
  readonly healthUrl = `${API_URL}/auth/check`

  private accessToken: string | null = null
  private refreshToken: string | null = null
  private refreshPromise: Promise<boolean> | null = null

  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_KEY)
    this.refreshToken = localStorage.getItem(REFRESH_KEY)
    apiClient.registerProvider(this)
  }

  // --- AuthProvider ----------------------------------------------------

  getAuthHeaders(): Record<string, string> {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}
  }

  isAccessValid(): boolean {
    // Без expiresAt не можем проверить локально — доверяем токену.
    // Когда появится refresh (и expiresAt), можно будет проверять.
    return Boolean(this.accessToken)
  }

  hasRefreshToken(): boolean {
    return Boolean(this.refreshToken)
  }

  async refreshAccess(): Promise<boolean> {
    if (!this.refreshToken) return false
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        })
        if (!res.ok) return false
        const data = (await res.json()) as { accessToken: string }
        this.accessToken = data.accessToken
        localStorage.setItem(ACCESS_KEY, data.accessToken)
        return true
      } catch {
        return false
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  // --- IYandexService --------------------------------------------------

  isDisconnected(): boolean {
    return localStorage.getItem(DISCONNECTED_KEY) === 'true'
  }

  setDisconnected(val: boolean) {
    if (val) localStorage.setItem(DISCONNECTED_KEY, 'true')
    else localStorage.removeItem(DISCONNECTED_KEY)
  }

  async login(ctx: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctx, password }),
      })
      if (!res.ok) return false
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      this.accessToken = data.accessToken
      this.refreshToken = data.refreshToken
      localStorage.setItem(ACCESS_KEY, data.accessToken)
      localStorage.setItem(REFRESH_KEY, data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  logout() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })

    const res = await apiClient.fetch(`${API_URL}/resources?${params.toString()}`, {
      auth: 'yandex-self',
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error || 'Failed to fetch')
    }
    return res.json() as Promise<YandexResourcesResponse>
  }

  buildDownloadUrl(path: string): string {
    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })
    if (this.accessToken) params.set('token', this.accessToken)
    return `${API_URL}/download?${params.toString()}`
  }

  /**
   * Универсальный fetch с авторизацией и рефрешем.
   * Используется в downloadUrlToFile (см. yandexSelf/index.ts).
   *
   * Не трогает credentials: downloadUrlToFile сам добавляет 'include',
   * для yandex-self это безвредно (Bearer-токен, не cookie).
   */
  fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    return apiClient.fetch(url, { auth: this.id, ...init })
  }

  async readTextFile(remotePath: string): Promise<YandexTextResponse | null> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await apiClient.fetch(`${API_URL}/text?${params.toString()}`, {
      auth: 'yandex-self',
    })

    if (!res.ok) return null
    return res.json() as Promise<YandexTextResponse>
  }

  async writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await apiClient.fetch(`${API_URL}/text?${params.toString()}`, {
      auth: 'yandex-self',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) throw new Error('Failed to write')
    return res.json() as Promise<YandexWriteResponse>
  }
}

export const yandexSelfService = new YandexSelfService()
