// src/services/ui/ThemeService.spec.ts

// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeService } from './ThemeService';

function createService(): ThemeService {
  return new ThemeService();
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('load с пустым localStorage → default', () => {
    const service = createService();
    service.load();
    expect(service.current.value).toBe('default');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('ui:theme')).toBe('default');
  });

  it('load с валидным значением → применяет', () => {
    localStorage.setItem('ui:theme', 'radio');
    const service = createService();
    service.load();
    expect(service.current.value).toBe('radio');
    expect(document.documentElement.getAttribute('data-theme')).toBe('radio');
  });

  it('load с битым значением → default', () => {
    localStorage.setItem('ui:theme', 'nonsense');
    const service = createService();
    service.load();
    expect(service.current.value).toBe('default');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('apply(default) снимает атрибут', () => {
    document.documentElement.setAttribute('data-theme', 'radio');
    const service = createService();
    service.apply('default');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('apply(radio) ставит атрибут и пишет в localStorage', () => {
    const service = createService();
    service.apply('radio');
    expect(document.documentElement.getAttribute('data-theme')).toBe('radio');
    expect(localStorage.getItem('ui:theme')).toBe('radio');
  });

  it('load переживает недоступный localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = createService();
    expect(() => service.load()).not.toThrow();
    spy.mockRestore();
  });
});
