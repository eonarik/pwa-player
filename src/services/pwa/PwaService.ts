// src/services/pwa/PwaService.ts

import { ref, type Ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const LAST_CHECK_KEY = 'pwa:lastUpdateCheck'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface PwaService {
  readonly needRefresh: Ref<boolean>
  readonly registration: Ref<ServiceWorkerRegistration | null>
  init(): void
  checkForUpdates(): Promise<void>
  applyUpdate(): Promise<void>
}

class PwaServiceImpl implements PwaService {
  private static instance: PwaServiceImpl | null = null

  readonly needRefresh = ref(false)
  readonly registration = ref<ServiceWorkerRegistration | null>(null)

  private initialized = false
  private updateSW: ((reload?: boolean) => Promise<void>) | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null

  static getInstance(): PwaServiceImpl {
    if (!PwaServiceImpl.instance) {
      PwaServiceImpl.instance = new PwaServiceImpl()
    }
    return PwaServiceImpl.instance
  }

  init(): void {
    if (this.initialized) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    this.initialized = true

    this.updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        this.needRefresh.value = true
      },
      onOfflineReady: () => {
        console.info('[pwa] ready for offline')
      },
      onRegisteredSW: (_swUrl, reg) => {
        if (!reg) return
        this.registration.value = reg

        this.startInterval()
        document.addEventListener('visibilitychange', this.onVisibilityChange)
      },
      onRegisterError: (err) => {
        console.error('[pwa] register error', err)
      },
    })

    void this.checkForUpdates()
  }

  async checkForUpdates(): Promise<void> {
    if (this.isCoolingDown()) return
    const reg = this.registration.value
    if (!reg) return

    try {
      await reg.update()
      this.markChecked()
    } catch (err) {
      console.warn('[pwa] checkForUpdates failed', err)
    }
  }

  async applyUpdate(): Promise<void> {
    if (this.updateSW) {
      await this.updateSW(true)
    }
  }

  private startInterval(): void {
    if (this.intervalId !== null) return
    this.intervalId = setInterval(() => {
      void this.checkForUpdates()
    }, CHECK_INTERVAL_MS)
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void this.checkForUpdates()
    }
  }

  private isCoolingDown(): boolean {
    try {
      const raw = localStorage.getItem(LAST_CHECK_KEY)
      if (!raw) return false
      const last = Number(raw)
      if (!Number.isFinite(last)) return false
      return Date.now() - last < CHECK_INTERVAL_MS
    } catch {
      return false
    }
  }

  private markChecked(): void {
    try {
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
    } catch {
      // ignore
    }
  }
}

export const pwaService = PwaServiceImpl.getInstance()
