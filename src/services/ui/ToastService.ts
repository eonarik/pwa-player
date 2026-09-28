// src/services/ui/ToastService.ts

import { ref } from 'vue'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface Toast {
  id: string
  message: string
  type: ToastType
  /** Автоскрытие через N мс. 0 = не скрывать */
  duration: number
  /** Кнопка действия (опционально) */
  action?: ToastAction
  createdAt: number
}

const DEFAULT_DURATION = 4000
const MAX_TOASTS = 5

class ToastService {
  private static instance: ToastService | null = null

  readonly toasts = ref<Toast[]>([])

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService()
    }
    return ToastService.instance
  }

  show(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION): string {
    const id = crypto.randomUUID()
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
    }

    this.toasts.value = [...this.toasts.value, toast].slice(-MAX_TOASTS)

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration)
    }

    return id
  }

  /**
   * Постоянный тост — не исчезает сам.
   * Обычно с кнопкой действия (например, «Перезагрузить»).
   */
  showPersistent(message: string, type: ToastType = 'info', action?: ToastAction): string {
    const id = crypto.randomUUID()
    const toast: Toast = {
      id,
      message,
      type,
      duration: 0,
      action,
      createdAt: Date.now(),
    }

    this.toasts.value = [...this.toasts.value, toast].slice(-MAX_TOASTS)
    return id
  }

  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration)
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration ?? 6000)
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration)
  }

  dismiss(id: string): void {
    this.toasts.value = this.toasts.value.filter((t) => t.id !== id)
  }

  clear(): void {
    this.toasts.value = []
  }
}

export const toastService = ToastService.getInstance()
