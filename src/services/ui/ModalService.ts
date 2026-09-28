// src/services/ui/ModalService.ts

import { shallowRef } from 'vue'
import type { ModalOptions } from '@/plugins/types'

/** Активная модалка. null = ничего не показано. */
export interface ActiveModal {
  id: string
  options: ModalOptions
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

class ModalService {
  private static instance: ModalService | null = null

  /** Реактивное состояние — ModalHost подписывается */
  readonly active = shallowRef<ActiveModal | null>(null)

  static getInstance(): ModalService {
    if (!ModalService.instance) {
      ModalService.instance = new ModalService()
    }
    return ModalService.instance
  }

  /**
   * Показать модалку. Возвращает промис, который разрешится,
   * когда пользователь подтвердит или отменит.
   */
  show<T>(options: ModalOptions): Promise<T> {
    if (this.active.value) {
      // Не даём открыть вторую модалку поверх первой
      return Promise.reject(new Error('[modal] another modal is already open'))
    }

    return new Promise<T>((resolve, reject) => {
      this.active.value = {
        id: crypto.randomUUID(),
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
      }
    })
  }

  /** Пользователь подтвердил (значение зависит от типа модалки) */
  confirm(value: unknown): void {
    const modal = this.active.value
    if (!modal) return
    this.active.value = null
    modal.resolve(value)
  }

  /** Пользователь отменил */
  cancel(): void {
    const modal = this.active.value
    if (!modal) return
    this.active.value = null
    modal.resolve(null)
  }

  /** Закрыть с ошибкой */
  error(reason: unknown): void {
    const modal = this.active.value
    if (!modal) return
    this.active.value = null
    modal.reject(reason)
  }
}

export const modalService = ModalService.getInstance()
