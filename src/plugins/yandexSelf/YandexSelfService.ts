// src/plugins/yandexSelf/YandexSelfService.ts
import type {
  IYandexService,
  YandexResourcesResponse,
  YandexTextResponse,
  YandexWriteResponse,
} from '../yandexDisk/types'
import { cleanDiskPath } from '@/shared/paths'

const API_URL = '/api/yandex-self'
const ACCESS_KEY = 'yandex-self-access'
const REFRESH_KEY = 'yandex-self-refresh'
const DISCONNECTED_KEY = 'yandex-self-disconnected'

export class YandexSelfService implements IYandexService {
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private refreshPromise: Promise<boolean> | null = null

  constructor() {
    this.accessToken = localStorage.getItem(ACCESS_KEY)
    this.refreshToken = localStorage.getItem(REFRESH_KEY)
  }

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
      const data = await res.json()
      this.accessToken = data.accessToken
      this.refreshToken = data.refreshToken
      localStorage.setItem(ACCESS_KEY, data.accessToken)
      localStorage.setItem(REFRESH_KEY, data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  async refresh(): Promise<boolean> {
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
        const data = await res.json()
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

  logout() {
    this.accessToken = null
    this.refreshToken = null
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  hasRefreshToken(): boolean {
    return Boolean(this.refreshToken)
  }

  /**
   * Универсальная обертка: делает запрос, если 401 — рефрешит и повторяет.
   * Защита от race-condition: если токен уже обновился другим запросом,
   * не дёргает /refresh повторно.
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const doFetch = (token: string) =>
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      })

    const tokenAtStart = this.accessToken ?? ''
    const res = await doFetch(tokenAtStart)

    if (res.status !== 401) return res

    // Токен уже обновился (другой запрос успел) — просто retry.
    if (this.accessToken && this.accessToken !== tokenAtStart) {
      return doFetch(this.accessToken)
    }

    if (!this.refreshToken) return res

    const ok = await this.refresh()
    if (ok && this.accessToken) {
      return doFetch(this.accessToken)
    }

    return res
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    if (!this.accessToken) throw new Error('Not authenticated')
    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })

    const res = await this.fetchWithAuth(`${API_URL}/resources?${params.toString()}`)

    if (res.status === 401) {
      this.logout()
      throw new Error('Session expired')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to fetch')
    }
    return res.json()
  }

  buildDownloadUrl(path: string): string {
    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })
    if (this.accessToken) params.set('token', this.accessToken)
    return `${API_URL}/download?${params.toString()}`
  }

  async readTextFile(remotePath: string): Promise<YandexTextResponse | null> {
    if (!this.accessToken) return null
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await this.fetchWithAuth(`${API_URL}/text?${params.toString()}`)

    if (!res.ok) return null
    return res.json()
  }

  async writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse> {
    if (!this.accessToken) throw new Error('Not authenticated')
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await this.fetchWithAuth(`${API_URL}/text?${params.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) throw new Error('Failed to write')
    return res.json()
  }
}

export const yandexSelfService = new YandexSelfService()
