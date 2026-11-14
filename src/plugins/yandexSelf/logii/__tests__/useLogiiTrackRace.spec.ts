// src/plugins/yandexSelf/logii/__tests__/useLogiiTrackRace.spec.ts
// CUEI-0023: при быстром переключении папок устаревший ответ не должен
// перезаписывать данные новой папки.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const readLogiiFileMock = vi.fn();

vi.mock('../logiiApi', () => ({
  readLogiiFile: (...args: unknown[]) => readLogiiFileMock(...args),
  writeLogiiFile: vi.fn(),
}));

import { useLogiiTrack } from '../useLogiiData';

function fileResult(content: string, fileName = 'vibe.logii.txt') {
  return { content, modified: 'm1', fileName, fromCache: false };
}

describe('useLogiiTrack: race condition (CUEI-0023)', () => {
  beforeEach(() => {
    readLogiiFileMock.mockReset();
  });

  it('устаревший ответ не перезаписывает данные после смены папки', async () => {
    const trackUrlPath = ref('logii.S/uA/1');
    const fileName = ref('vibe.logii.txt');

    const first = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();
    const second = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();

    readLogiiFileMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const track = useLogiiTrack(trackUrlPath, fileName);

    // 1. Старт загрузки папки A
    const firstCall = track.reload();

    // 2. Быстрое переключение на папку B
    trackUrlPath.value = 'logii.S/uA/2';
    const secondCall = track.reload();

    // 3. Первым приходит ОТВЕТ A (устаревший)
    first.resolve(fileResult('CONTENT A'));
    await firstCall;
    await nextTick();

    // Данные ещё не должны быть установлены устаревшим ответом
    expect(track.data.value?.vibe).not.toBe('CONTENT A');

    // 4. Приходит ответ B (актуальный)
    second.resolve(fileResult('CONTENT B'));
    await secondCall;
    await nextTick();

    expect(track.data.value?.vibe).toBe('CONTENT B');
    expect(track.isLoading.value).toBe(false);
  });

  it('актуальный ответ применяется, а isLoading сбрасывается только им', async () => {
    const trackUrlPath = ref('logii.S/uA/1');
    const fileName = ref('vibe.logii.txt');

    const slow = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();
    const fast = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();

    readLogiiFileMock.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const track = useLogiiTrack(trackUrlPath, fileName);

    const slowCall = track.reload();

    fileName.value = 'other.logii.txt';
    const fastCall = track.reload();

    // быстрый ответ приходит раньше
    fast.resolve(fileResult('FAST', 'other.logii.txt'));
    await fastCall;
    await nextTick();

    expect(track.data.value?.vibe).toBe('FAST');
    expect(track.isLoading.value).toBe(false);

    // медленный ответ приходит позже — не должен перезаписать
    slow.resolve(fileResult('SLOW'));
    await slowCall;
    await nextTick();

    expect(track.data.value?.vibe).toBe('FAST');
  });

  it('ошибка устаревшего запроса не устанавливает error', async () => {
    const trackUrlPath = ref('logii.S/uA/1');
    const fileName = ref('vibe.logii.txt');

    const first = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();
    const second = deferred<{ content: string; modified: string | null; fileName: string; fromCache: boolean }>();

    readLogiiFileMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const track = useLogiiTrack(trackUrlPath, fileName);

    const firstCall = track.reload();
    trackUrlPath.value = 'logii.S/uA/2';
    const secondCall = track.reload();

    first.reject(new Error('network'));
    await firstCall;
    await nextTick();

    expect(track.error.value).toBe('');

    second.resolve(fileResult('OK'));
    await secondCall;
    await nextTick();

    expect(track.data.value?.vibe).toBe('OK');
    expect(track.error.value).toBe('');
  });
});
