// src/services/yandex/YandexDiskService.ts

const PROXY_URL = import.meta.env.VITE_DISK_PROXY_URL ?? 'http://localhost:3000'

export interface YandexItem {
  path: string
  name: string
  type: 'dir' | 'file'
  size?: number
  mime_type?: string
  media_type?: string
  created?: string
  modified?: string
  isAudio?: boolean
}

export interface YandexResourcesResponse {
  path: string
  total: number
  items: YandexItem[]
}

export interface YandexConfig {
  musicPath: string
}

export class YandexDiskService {
  private static instance: YandexDiskService | null = null

  static getInstance(): YandexDiskService {
    if (!YandexDiskService.instance) {
      YandexDiskService.instance = new YandexDiskService()
    }
    return YandexDiskService.instance
  }

  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${PROXY_URL}/health`)
      return res.ok
    } catch {
      return false
    }
  }

  /** Конфиг прокси (путь к музыке по умолчанию и т.п.) */
  async getConfig(): Promise<YandexConfig> {
    const res = await fetch(`${PROXY_URL}/api/config`)
    if (!res.ok) {
      throw new Error(`Failed to fetch config: HTTP ${res.status}`)
    }
    return res.json() as Promise<YandexConfig>
  }

  async listResources(path = '/'): Promise<YandexResourcesResponse> {
    const url = new URL(`${PROXY_URL}/api/disk/resources`)
    url.searchParams.set('path', path)

    const response = await fetch(url.toString())
    if (!response.ok) {
      const error = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string
      }
      throw new Error(error.error ?? `HTTP ${response.status}`)
    }

    return response.json() as Promise<YandexResourcesResponse>
  }

  buildDownloadUrl(path: string): string {
    const url = new URL(`${PROXY_URL}/api/disk/download`)
    url.searchParams.set('path', path)
    return url.toString()
  }
}

export const yandexDiskService = YandexDiskService.getInstance()
