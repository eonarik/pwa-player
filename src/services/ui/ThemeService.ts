// src/services/ui/ThemeService.ts

import { ref } from 'vue';

export type ThemeId = string;

const STORAGE_KEY = 'ui:theme';

const THEMES: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: 'default', label: 'Тёмная' },
  { id: 'radio', label: 'Ретро-радио' },
  { id: 'neon', label: 'Киберпанк' },
  { id: 'barbie', label: 'Барби' },
];

export class ThemeService {
  private static instance: ThemeService | null = null;

  readonly current = ref<ThemeId>('default');
  readonly available = THEMES;

  static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Читает тему из localStorage и применяет.
   * Битое значение → default.
   */
  load(): void {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage может быть недоступен (приватный режим)
    }

    if (saved && this.isValid(saved)) {
      this.apply(saved);
    } else {
      this.apply('default');
    }
  }

  apply(id: ThemeId): void {
    this.current.value = id;
    const root = document.documentElement;
    if (id === 'default') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', id);
    }
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  private isValid(value: string): value is ThemeId {
    return THEMES.some((t) => t.id === value);
  }
}

export const themeService = ThemeService.getInstance();
