// src/plugins/yandexSelf/YandexSelfService.ts
import type {
  IYandexService,
  YandexResourcesResponse,
} from '../yandexDisk/types'

const API_URL = '/api/yandex-self'

export class YandexSelfService implements IYandexService {
  private token: string | null = null

  constructor() {
    this.token = localStorage.getItem('yandex-self-token')
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
      localStorage.setItem('yandex-self-token', data.token!)
      return true
    } catch {
      return false
    }
  }

  logout() {
    this.token = null
    localStorage.removeItem('yandex-self-token')
  }

  // Очищаем путь от 'disk:/' перед отправкой
  private cleanPath(path: string): string {
    return path.replace(/^disk:/, '').replace(/^\/+/, '') || '/'
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    if (!this.token) throw new Error('Not authenticated')

    const clean = this.cleanPath(path)
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
    const clean = this.cleanPath(path)
    const params = new URLSearchParams({ path: clean })

    // Добавляем токен в query, чтобы <audio> мог его передать
    if (this.token) {
      params.set('token', this.token)
    }

    return `${API_URL}/download?${params.toString()}`
  }

  async readTextFile(
    remotePath: string,
  ): Promise<{ content: string; modified: string | null; size: number | null } | null> {
    const clean = this.cleanPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    try {
      const res = await fetch(`${API_URL}/text?${params.toString()}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  async writeTextFile(
    remotePath: string,
    content: string,
  ): Promise<{ ok: boolean; modified: string | null }> {
    const clean = this.cleanPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await fetch(`${API_URL}/text?${params.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ content }),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || 'Failed to save')
    }

    return res.json()
  }
}

export const yandexSelfService = new YandexSelfService()
