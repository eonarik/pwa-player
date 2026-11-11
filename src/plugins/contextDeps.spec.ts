// src/plugins/contextDeps.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LibraryWriter } from '@/services/library/LibraryWriter';

/**
 * contextDeps хранит singleton-ссылку, поэтому каждый тест получает
 * чистую копию модуля через vi.resetModules + динамический импорт.
 */
async function importFresh() {
  vi.resetModules();
  return import('./contextDeps');
}

const fakeWriter = { __fake: 'writer' } as unknown as LibraryWriter;

describe('contextDeps', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('бросает понятную ошибку, если deps не инициализирован', async () => {
    const { getPluginContextDeps } = await importFresh();

    expect(() => getPluginContextDeps()).toThrow(/не инициализирован/);
  });

  it('возвращает тот же объект после setPluginContextDeps', async () => {
    const { setPluginContextDeps, getPluginContextDeps } = await importFresh();

    const deps = {
      createWriter: () => fakeWriter,
      getDownloadDir: async () => null,
    };
    setPluginContextDeps(deps);

    expect(getPluginContextDeps()).toBe(deps);
  });

  it('createWriter вызывается лениво — по одному разу на вызов', async () => {
    const { setPluginContextDeps, getPluginContextDeps } = await importFresh();

    const createWriter = vi.fn(() => fakeWriter);
    setPluginContextDeps({ createWriter, getDownloadDir: async () => null });

    expect(createWriter).not.toHaveBeenCalled();

    getPluginContextDeps().createWriter();
    getPluginContextDeps().createWriter();

    expect(createWriter).toHaveBeenCalledTimes(2);
  });

  it('повторный set перезаписывает зависимости', async () => {
    const { setPluginContextDeps, getPluginContextDeps } = await importFresh();

    setPluginContextDeps({ createWriter: () => fakeWriter, getDownloadDir: async () => null });

    const other = { __fake: 'other' } as unknown as LibraryWriter;
    setPluginContextDeps({ createWriter: () => other, getDownloadDir: async () => null });

    expect(getPluginContextDeps().createWriter()).toBe(other);
  });
});
