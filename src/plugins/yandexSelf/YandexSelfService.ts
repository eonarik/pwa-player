// src/plugins/yandexSelf/YandexSelfService.ts

import type {
  IYandexService,
  YandexResourcesResponse,
  YandexTextResponse,
  YandexWriteResponse,
} from '../yandexDisk/types';
import { modalService } from '@/services/ui/ModalService';
import { cleanDiskPath } from '@/shared/paths';
import { apiClient, type AuthProvider } from '@/services/api/ApiClient';
import { AuthError } from '@/services/api/errors';

const API_URL = '/api/yandex-self';
const DISCONNECTED_KEY = 'yandex-self-disconnected';

export class YandexSelfService implements IYandexService, AuthProvider {
  readonly id = 'yandex-self';
  readonly healthUrl = `${API_URL}/auth/check`;

  private static instance: YandexSelfService | null = null;

  private constructor() {
    apiClient.registerProvider(this);
  }

  static getInstance(): YandexSelfService {
    if (!YandexSelfService.instance) {
      YandexSelfService.instance = new YandexSelfService();
    }
    return YandexSelfService.instance;
  }

  // --- AuthProvider ----------------------------------------------------

  isAccessValid(): boolean {
    return true;
  }

  hasRefreshToken(): boolean {
    return false;
  }

  async refreshAccess(): Promise<boolean> {
    return false;
  }

  getAuthHeaders(): Record<string, string> {
    return {};
  }

  // --- IYandexService --------------------------------------------------

  isDisconnected(): boolean {
    return localStorage.getItem(DISCONNECTED_KEY) === 'true';
  }

  setDisconnected(val: boolean) {
    if (val) localStorage.setItem(DISCONNECTED_KEY, 'true');
    else localStorage.removeItem(DISCONNECTED_KEY);
  }

  async login(): Promise<boolean> {
    const alive = await this.checkSession?.();
    if (alive === 'ok') {
      this.setDisconnected(false);
      return true;
    }

    const code = await modalService.show<string>({
      title: 'Вход в Логии',
      message: 'Введите пароль (необязательно)',
      type: 'input',
      inputType: 'password',
    });

    if (code === null) return false;

    let ctx = 'common';
    let password = code;

    if (code.includes(':')) {
      const parts = code.split(':');
      ctx = parts[0] || 'common';
      password = parts[1] || '';
    }

    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctx, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) {
          throw new Error(data.error || 'Неверный пароль');
        }

        throw new Error(data.error || 'Ошибка сервера при подключении');
      }

      this.setDisconnected(false);
      return true;
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('Ошибка сети');
    }
  }

  async checkSession(): Promise<'ok' | 'expired' | 'unavailable'> {
    try {
      const res = await apiClient.fetch(`${API_URL}/auth/check`, {
        auth: this.id,
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 401) return 'expired';
      if (!res.ok) return 'unavailable';
      return 'ok';
    } catch (err) {
      if (err instanceof AuthError) return 'expired';
      return 'unavailable';
    }
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.warn('[yandex-self] logout failed', err);
    } finally {
      this.setDisconnected(true);
    }
  }

  async listResources(path: string): Promise<YandexResourcesResponse> {
    const clean = cleanDiskPath(path);
    const params = new URLSearchParams({ path: clean });

    const res = await apiClient.fetch(`${API_URL}/resources?${params.toString()}`, {
      auth: this.id,
      method: 'GET',
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to fetch');
    }
    return res.json() as Promise<YandexResourcesResponse>;
  }

  buildDownloadUrl(path: string): string {
    const clean = cleanDiskPath(path);
    const params = new URLSearchParams({ path: clean });
    return `${API_URL}/download?${params.toString()}`;
  }

  async readTextFile(remotePath: string): Promise<YandexTextResponse | null> {
    const clean = cleanDiskPath(remotePath);
    const params = new URLSearchParams({ path: clean });

    const res = await apiClient.fetch(`${API_URL}/text?${params.toString()}`, {
      auth: this.id,
      method: 'GET',
    });

    if (!res.ok) return null;
    return res.json() as Promise<YandexTextResponse>;
  }

  async writeTextFile(remotePath: string, content: string): Promise<YandexWriteResponse> {
    const clean = cleanDiskPath(remotePath);
    const params = new URLSearchParams({ path: clean });

    const res = await apiClient.fetch(`${API_URL}/text?${params.toString()}`, {
      auth: this.id,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) throw new Error('Failed to write');
    return res.json() as Promise<YandexWriteResponse>;
  }
}

export const yandexSelfService = YandexSelfService.getInstance();
