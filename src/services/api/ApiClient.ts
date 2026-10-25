// src/services/api/ApiClient.ts

import { AuthError, ServerError, NetworkError } from './errors'

export interface AuthProvider {
  /** Уникальный id провайдера (совпадает с pluginId). */
  readonly id: string

  /**
   * URL для лёгкой проверки сессии (health-check).
   * Должен возвращать 200 при валидном токене и 401 при истёкшем.
   * Если провайдер не поддерживает health-check — `null`.
   */
  readonly healthUrl: string | null

  /** Синхронная проверка: жив ли access-токен по локальным данным. */
  isAccessValid(): boolean

  /** Есть ли refresh-токен. */
  hasRefreshToken(): boolean

  /** Обновить access-токен. Возвращает true при успехе. */
  refreshAccess(): Promise<boolean>

  /** Заголовки для авторизованного запроса. */
  getAuthHeaders(): Record<string, string>
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * id провайдера для авторизации.
   * Если не задан — запрос уходит без auth-заголовков.
   */
  auth?: string
}

class ApiClient {
  private static instance: ApiClient | null = null

  private providers = new Map<string, AuthProvider>()

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  registerProvider(provider: AuthProvider): void {
    this.providers.set(provider.id, provider)
  }

  getProvider(providerId: string): AuthProvider | undefined {
    return this.providers.get(providerId)
  }

  /**
   * Гарантирует, что access-токен провайдера валиден.
   * Если `isAccessValid()` === false и есть refresh-токен — пробует обновить.
   *
   * Бросает AuthError, если сессию восстановить не удалось.
   * Если провайдер не зарегистрирован — no-op (запрос уйдёт без auth).
   */
  async ensureAuth(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId)
    if (!provider) return
    if (provider.isAccessValid()) return

    if (!provider.hasRefreshToken()) {
      throw new AuthError({ providerId, reason: 'no-refresh-token' })
    }

    const refreshed = await this.tryRefresh(provider)
    if (!refreshed) {
      throw new AuthError({ providerId, reason: 'refresh-expired' })
    }
  }

  /**
   * Универсальный fetch с обработкой 401 (refresh + retry), 5xx и сетевых ошибок.
   * Кидает типизированные ошибки (AuthError / ServerError / NetworkError).
   */
  async fetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
    const { auth, ...init } = options
    const provider = auth ? this.providers.get(auth) : undefined

    // 1. Превентивный рефреш, если провайдер знает, что токен мёртв.
    if (provider && !provider.isAccessValid()) {
      if (!provider.hasRefreshToken()) {
        throw new AuthError({ providerId: provider.id, reason: 'no-refresh-token' })
      }
      const refreshed = await this.tryRefresh(provider)
      if (!refreshed) {
        throw new AuthError({ providerId: provider.id, reason: 'refresh-expired' })
      }
    }

    // 2. Запрос.
    let res = await this.safeFetch(url, init, provider)

    // 3. 401 — рефреш и ретрай.
    if (res.status === 401 && provider) {
      if (!provider.hasRefreshToken()) {
        throw new AuthError({ providerId: provider.id, reason: 'no-refresh-token' })
      }
      const refreshed = await this.tryRefresh(provider)
      if (!refreshed) {
        throw new AuthError({ providerId: provider.id, reason: 'refresh-expired' })
      }
      res = await this.safeFetch(url, init, provider)
    }

    // 4. 5xx.
    if (res.status >= 500) {
      throw new ServerError(res.status)
    }

    return res
  }

  /**
   * Проверка сессии для провайдера.
   * Кидает AuthError / ServerError / NetworkError как `fetch`.
   *
   * Если провайдер не зарегистрирован или не поддерживает health-check —
   * no-op (доверяем вызывающему).
   */
  async healthCheck(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId)
    if (!provider) return
    if (!provider.healthUrl) return

    const res = await this.fetch(provider.healthUrl, {
      auth: providerId,
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!res.ok) {
      throw new ServerError(res.status)
    }
  }

  private async safeFetch(
    url: string,
    init: RequestInit,
    provider: AuthProvider | undefined,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      ...(provider ? provider.getAuthHeaders() : {}),
    }

    try {
      return await fetch(url, { ...init, headers })
    } catch (err) {
      throw new NetworkError(err)
    }
  }

  private async tryRefresh(provider: AuthProvider): Promise<boolean> {
    if (!provider.hasRefreshToken()) return false
    try {
      return await provider.refreshAccess()
    } catch {
      return false
    }
  }
}

export const apiClient = ApiClient.getInstance()
