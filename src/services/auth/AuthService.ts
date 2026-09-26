// src/services/auth/AuthService.ts

const PROXY_URL = import.meta.env.VITE_DISK_PROXY_URL ?? ''
const TOKEN_KEY = 'player:authToken'

export class AuthService {
  private static instance: AuthService | null = null

  private token: string | null = null

  private constructor() {
    this.token = localStorage.getItem(TOKEN_KEY)
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  getToken(): string | null {
    return this.token
  }

  isAuthenticated(): boolean {
    return this.token !== null
  }

  async login(password: string): Promise<boolean> {
    try {
      const res = await fetch(`${PROXY_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) return false

      const data = (await res.json()) as { ok: boolean; token?: string }
      if (!data.ok || !data.token) return false

      this.token = data.token
      localStorage.setItem(TOKEN_KEY, data.token)
      return true
    } catch (err) {
      console.error('[auth] login failed', err)
      return false
    }
  }

  logout(): void {
    this.token = null
    localStorage.removeItem(TOKEN_KEY)
  }

  async check(): Promise<boolean> {
    if (!this.token) return false

    try {
      const res = await fetch(`${PROXY_URL}/api/auth/check`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      if (!res.ok) {
        this.logout()
        return false
      }
      return true
    } catch {
      return false
    }
  }

  authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {}
  }
}

export const authService = AuthService.getInstance()
