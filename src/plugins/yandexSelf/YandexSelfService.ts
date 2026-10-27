// src/plugins/yandexSelf/YandexSelfService.ts

import type {
  IYandexService,
  YandexResourcesResponse,
  YandexTextResponse,
  YandexWriteResponse,
} from '../yandexDisk/types'
import { modalService } from '@/services/ui/ModalService'
import { cleanDiskPath } from '@/shared/paths'

const API_URL = '/api/yandex-self'
const DISCONNECTED_KEY = 'yandex-self-disconnected'

export class YandexSelfService implements IYandexService {
  readonly id = 'yandex-self'

  // --- IYandexService --------------------------------------------------

  isDisconnected(): boolean {
    return localStorage.getItem(DISCONNECTED_KEY) === 'true'
  }

  setDisconnected(val: boolean) {
    if (val) localStorage.setItem(DISCONNECTED_KEY, 'true')
    else localStorage.removeItem(DISCONNECTED_KEY)
  }

  async login(): Promise<boolean> {
    // 1. Проверяем, может, уже залогинены
    const alive = await this.checkSession?.()
    if (alive === 'ok') return true

    // 2. Спрашиваем пароль через модалку
    const code = await modalService.show<string>({
      title: 'Вход в Логии',
      message: 'Введите пароль (необязательно)',
      type: 'input',
      inputType: 'password',
    })

    if (code === null) return false // Пользователь отменил

    let ctx = 'common'
    let password = code

    if (code.includes(':')) {
      const parts = code.split(':')
      ctx = parts[0] || 'common'
      password = parts[1] || ''
    }

    // 3. Делаем запрос
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctx, password }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))

        // 401 — неверный пароль
        if (res.status === 401) {
          throw new Error(data.error || 'Неверный пароль')
        }

        // 500+ — ошибка сервера (таймаут)
        throw new Error(data.error || 'Ошибка сервера при подключении')
      }

      localStorage.removeItem(DISCONNECTED_KEY)
      return true
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error('Ошибка сети')
    }
  }

  async checkSession(): Promise<'ok' | 'expired' | 'unavailable'> {
    try {
      const res = await fetch(`${API_URL}/auth/check`, {
        credentials: 'include',
        signal: AbortSignal.timeout(5000),
      })
      if (res.status === 401) return 'expired'
      if (!res.ok) return 'unavailable'
      return 'ok'
    } catch {
      return 'unavailable'
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.warn('[yandex-self] logout failed', err)
    }
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    const clean = cleanDiskPath(path)
    const params = new URLSearchParams({ path: clean })

    const res = await fetch(`${API_URL}/resources?${params.toString()}`, {
      credentials: 'include',
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
    return `${API_URL}/download?${params.toString()}`
  }

  async readTextFile(remotePath: string): Promise<YandexTextResponse | null> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await fetch(`${API_URL}/text?${params.toString()}`, {
      credentials: 'include',
    })

    if (!res.ok) return null
    return res.json() as Promise<YandexTextResponse>
  }

  async writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse> {
    const clean = cleanDiskPath(remotePath)
    const params = new URLSearchParams({ path: clean })

    const res = await fetch(`${API_URL}/text?${params.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      credentials: 'include',
    })

    if (!res.ok) throw new Error('Failed to write')
    return res.json() as Promise<YandexWriteResponse>
  }
}

export const yandexSelfService = new YandexSelfService()
