// src/shared/paths.spec.ts

import { describe, it, expect } from 'vitest';
import { cleanDiskPath } from './paths';

describe('cleanDiskPath', () => {
  it('убирает префикс disk:', () => {
    expect(cleanDiskPath('disk:/Music/Rock')).toBe('Music/Rock');
  });

  it('убирает ведущие слэши', () => {
    expect(cleanDiskPath('///Music')).toBe('Music');
    expect(cleanDiskPath('/Music')).toBe('Music');
  });

  it('пустой путь → /', () => {
    expect(cleanDiskPath('')).toBe('/');
    expect(cleanDiskPath('/')).toBe('/');
    expect(cleanDiskPath('disk:/')).toBe('/');
  });

  it('не трогает вложенные слэши', () => {
    expect(cleanDiskPath('/Music/Rock/2020')).toBe('Music/Rock/2020');
  });

  it('не схлопывает .. (в отличие от normalizeClientPath)', () => {
    // Это ожидаемое поведение: cleanDiskPath не про безопасность,
    // а про формат запроса к API self-плагина.
    expect(cleanDiskPath('/../secret')).toBe('../secret');
  });
});
