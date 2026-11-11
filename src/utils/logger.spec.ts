// src/utils/logger.spec.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

/**
 * Logger — единственная точка вывода в консоль приложения.
 * В тестовом режиме (import.meta.env.MODE === 'test') информационные уровни молчат,
 * чтобы не засорять вывод Vitest, а ошибки проходят — иначе падающий тест потерял бы улики.
 */
describe('logger', () => {
  let calls: unknown[][];

  beforeEach(() => {
    calls = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      calls.push(args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не пишет info-уровни в тестовом режиме', () => {
    logger.log('log');
    logger.info('info');
    logger.warn('warn');
    logger.debug('debug');

    expect(calls).toEqual([]);
  });

  it('пишет ошибки, чтобы они остались в логе упавшего теста', () => {
    logger.error('boom', 42);

    expect(calls).toEqual([['boom', 42]]);
  });

  it('пробрасывает все аргументы без потерь', () => {
    const cause = new Error('inner');
    logger.error('outer', cause, { meta: 1 });

    // Третий аргумент — объект: проверяем количество вызовов и строку-префикс.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe('outer');
  });
});
