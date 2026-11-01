// src/composables/useClipboardWatcher.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withSetup } from '@/test/withSetup';
import { useClipboardWatcher } from './useClipboardWatcher';
import { toastService } from '@/services/ui/ToastService';

describe('useClipboardWatcher', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.spyOn(toastService, 'info').mockImplementation(() => 'test-id');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('показывает тост для новой строки CUEI1:', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        readText: vi.fn().mockResolvedValue('CUEI1:someencodedstring'),
      },
    });

    const { unmount } = withSetup(() => useClipboardWatcher());

    // Пропускаем задержку 2 секунды, чтобы слушатели прикрепились
    vi.advanceTimersByTime(2000);

    // Эмулируем фокус
    window.dispatchEvent(new Event('focus'));

    // Ждем выполнения промисов (readText асинхронный)
    await vi.runAllTimersAsync(); // flush microtasks & timers

    expect(toastService.info).toHaveBeenCalledWith(
      expect.stringContaining('В буфере найден плейлист'),
      expect.any(Number),
    );

    unmount();
  });

  it('не показывает тост повторно для той же строки', async () => {
    const text = 'CUEI1:anotherstring';
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { readText: vi.fn().mockResolvedValue(text) },
    });

    const { unmount } = withSetup(() => useClipboardWatcher());

    vi.advanceTimersByTime(2000);

    // Первый раз
    window.dispatchEvent(new Event('focus'));
    await vi.runAllTimersAsync();
    expect(toastService.info).toHaveBeenCalledTimes(1);

    // Второй раз
    window.dispatchEvent(new Event('focus'));
    await vi.runAllTimersAsync();
    expect(toastService.info).toHaveBeenCalledTimes(1); // не увеличилось

    unmount();
  });

  it('игнорирует текст без префикса CUEI1:', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { readText: vi.fn().mockResolvedValue('just a regular text') },
    });

    const { unmount } = withSetup(() => useClipboardWatcher());
    vi.advanceTimersByTime(2000);

    window.dispatchEvent(new Event('focus'));
    await vi.runAllTimersAsync();

    expect(toastService.info).not.toHaveBeenCalled();
    unmount();
  });
});
