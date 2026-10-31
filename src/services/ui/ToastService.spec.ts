// src/services/ui/ToastService.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToastService } from './ToastService';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = new ToastService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.clear();
  });

  it('создаёт новый тост при первом вызове', () => {
    const id = service.error('Ошибка');
    expect(service.toasts.value).toHaveLength(1);
    expect(service.toasts.value[0]!.message).toBe('Ошибка');
    expect(service.toasts.value[0]!.count).toBe(1);
    expect(id).toBeTruthy();
  });

  it('суммирует одинаковые сообщения в один тост', () => {
    service.error('Ошибка');
    service.error('Ошибка');
    service.error('Ошибка');

    expect(service.toasts.value).toHaveLength(1);
    expect(service.toasts.value[0]!.count).toBe(3);
  });

  it('не суммирует разные типы (info vs error)', () => {
    service.error('Ошибка');
    service.info('Ошибка');

    expect(service.toasts.value).toHaveLength(2);
    expect(service.toasts.value[0]!.type).toBe('error');
    expect(service.toasts.value[1]!.type).toBe('info');
  });

  it('не суммирует разные сообщения', () => {
    service.error('Ошибка 1');
    service.error('Ошибка 2');

    expect(service.toasts.value).toHaveLength(2);
    expect(service.toasts.value[0]!.count).toBe(1);
    expect(service.toasts.value[1]!.count).toBe(1);
  });

  it('сбрасывает таймер автоскрытия при инкременте', () => {
    service.error('Ошибка', 3000);

    vi.advanceTimersByTime(2000);
    expect(service.toasts.value).toHaveLength(1);

    service.error('Ошибка', 3000);
    expect(service.toasts.value[0]!.count).toBe(2);

    vi.advanceTimersByTime(2000);
    expect(service.toasts.value).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(service.toasts.value).toHaveLength(0);
  });

  it('показывает тост после истечения срока без инкремента', () => {
    service.error('Ошибка', 1000);
    vi.advanceTimersByTime(1000);
    expect(service.toasts.value).toHaveLength(0);
  });

  it('dismiss удаляет тост', () => {
    const id = service.error('Ошибка');
    expect(service.toasts.value).toHaveLength(1);

    service.dismiss(id);
    expect(service.toasts.value).toHaveLength(0);
  });

  it('clear удаляет все тосты и таймеры', () => {
    service.error('Ошибка 1');
    service.error('Ошибка 2');
    expect(service.toasts.value).toHaveLength(2);

    service.clear();
    expect(service.toasts.value).toHaveLength(0);
  });
});
