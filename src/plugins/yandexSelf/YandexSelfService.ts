// src/plugins/yandexSelf/YandexSelfService.ts
import type {
  IYandexService,
  YandexResourcesResponse,
  YandexTextResponse,
  YandexWriteResponse,
} from '../yandexDisk/types'
import { cleanDiskPath } from '@/shared/paths'

const API_URL = '/api/yandex-self'
const TOKEN_KEY = 'yandex-self-token'
const DISCONNECTED_KEY = 'yandex-self-disconnected'

export class YandexSelfService implements IYandexService {
  private token: string | null = null

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY)
  }

  isDisconnected(): boolean {
    return localStorage.getItem(DISCONNECTED_KEY) === 'true'
  }

  setDisconnected(val: boolean) {
    if (val) {
      localStorage.setItem(DISCONNECTED_KEY, 'true')
    } else {
      localStorage.removeItem(DISCONNECTED_KEY)
    }
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
      this.token = data.token
      localStorage.setItem(TOKEN_KEY, data.token!)
      return true
    } catch {
      return false
    }
  }

  logout() {
    this.token = null
    localStorage.removeItem(TOKEN_KEY)
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    if (!this.token) throw new Error('Not authenticated')

    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })

    const res = await fetch(`${API_URL}/resources?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })

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
    if (this.token) params.set('token', this.token)
    return `${API_URL}/download?${params.toString()}`
  }

  async readTextFile(remotePath: string): Promise<YandexTextResponse | null> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })
    const res = await fetch(`${API_URL}/text?${params.toString()}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    })
    if (!res.ok) return null
    return res.json()
  }

  async writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })
    const res = await fetch(`${API_URL}/text?${params.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ content }),
    })
    if (!res.ok) throw new Error('Failed to write')
    return res.json()
  }
}

export const yandexSelfService = new YandexSelfService()
