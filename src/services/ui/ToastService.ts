// src/services/ui/ToastService.ts

import { ref } from 'vue';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
  createdAt: number;
  count: number;
}

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 5;

export class ToastService {
  private static instance: ToastService | null = null;

  readonly toasts = ref<Toast[]>([]);
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  static getInstance(): ToastService {
    if (!ToastService.instance) {
      ToastService.instance = new ToastService();
    }
    return ToastService.instance;
  }

  show(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION): string {
    const existing = this.toasts.value.find((t) => t.message === message && t.type === type);

    if (existing) {
      existing.count += 1;
      existing.createdAt = Date.now();

      const oldTimer = this.timers.get(existing.id);
      if (oldTimer) clearTimeout(oldTimer);

      if (duration > 0) {
        this.timers.set(
          existing.id,
          setTimeout(() => this.dismiss(existing.id), duration),
        );
      } else {
        this.timers.delete(existing.id);
      }

      this.toasts.value = [...this.toasts.value];
      return existing.id;
    }

    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
      count: 1,
    };

    this.appendAndTrim(toast);

    if (duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), duration),
      );
    }

    return id;
  }

  showPersistent(message: string, type: ToastType = 'info', action?: ToastAction): string {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      type,
      duration: 0,
      action,
      createdAt: Date.now(),
      count: 1,
    };

    this.appendAndTrim(toast);
    return id;
  }

  update(id: string, message: string): void {
    this.toasts.value = this.toasts.value.map((t) => (t.id === id ? { ...t, message } : t));
  }

  success(message: string, duration?: number): string {
    return this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): string {
    return this.show(message, 'error', duration ?? 6000);
  }

  info(message: string, duration?: number): string {
    return this.show(message, 'info', duration);
  }

  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts.value = this.toasts.value.filter((t) => t.id !== id);
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts.value = [];
  }

  /**
   * Добавляет тост и удаляет старые, если превышен MAX_TOASTS.
   * Для каждого вытесненного тоста чистит его таймер.
   */
  private appendAndTrim(toast: Toast): void {
    const next = [...this.toasts.value, toast];

    while (next.length > MAX_TOASTS) {
      const dropped = next.shift()!;
      const timer = this.timers.get(dropped.id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(dropped.id);
      }
    }

    this.toasts.value = next;
  }
}

export const toastService = ToastService.getInstance();
