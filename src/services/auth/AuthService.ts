// src/services/auth/AuthService.ts

const PROXY_URL = '';
const REQUEST_TIMEOUT_MS = 10_000;

export interface AuthMeResponse {
  authenticated: boolean;
  expiresAt?: number | null;
}

export class AuthService {
  private static instance: AuthService | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Текущий статус авторизации.
   * Токена в JS нет — только cookie на сервере.
   */
  async me(): Promise<AuthMeResponse> {
    try {
      const res = await fetch(`${PROXY_URL}/api/auth/me`, {
        credentials: 'include',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) return { authenticated: false };
      return (await res.json()) as AuthMeResponse;
    } catch {
      return { authenticated: false };
    }
  }

  /**
   * Редирект на Яндекс OAuth.
   * Страница уйдёт — вызывающий код должен это учесть.
   */
  startOAuth(): void {
    window.location.href = `${PROXY_URL}/api/auth/yandex/start`;
  }

  /**
   * Выход: уничтожает серверную сессию и чистит cookie.
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${PROXY_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      console.warn('[auth] logout failed', err);
    }
  }
}

export const authService = AuthService.getInstance();
