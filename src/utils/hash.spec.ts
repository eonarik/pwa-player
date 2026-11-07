// src/utils/hash.spec.ts

import { describe, it, expect } from 'vitest';
import { simpleHash } from './hash';

describe('simpleHash', () => {
  it('возвращает hex-строку', () => {
    expect(simpleHash('abc')).toMatch(/^[0-9a-f]+$/);
  });

  it('детерминирован', () => {
    expect(simpleHash('userA')).toBe(simpleHash('userA'));
  });

  it('разные строки → разные хеши (в большинстве случаев)', () => {
    expect(simpleHash('userA')).not.toBe(simpleHash('userB'));
    expect(simpleHash('logii.2024')).not.toBe(simpleHash('logii.2025'));
  });

  it('пустая строка не падает и даёт детерминированный результат', () => {
    expect(simpleHash('')).toMatch(/^[0-9a-f]+$/);
    expect(simpleHash('')).toBe(simpleHash(''));
  });

  it('кириллица работает', () => {
    expect(simpleHash('Логии')).toMatch(/^[0-9a-f]+$/);
  });
});
