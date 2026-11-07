// src/plugins/yandexSelf/logii/authorColor.spec.ts

import { describe, it, expect } from 'vitest';
import { hashToHue, authorAvatarColor } from './authorColor';

describe('hashToHue', () => {
  it('детерминирован', () => {
    expect(hashToHue('userA')).toBe(hashToHue('userA'));
  });

  it('в диапазоне [0, 360)', () => {
    for (const name of ['userA', 'userB', 'Логии', 'a', '', 'x'.repeat(100)]) {
      const hue = hashToHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it('разные имена дают разные hue (в большинстве случаев)', () => {
    expect(hashToHue('userA')).not.toBe(hashToHue('userB'));
    expect(hashToHue('2024-11-08')).not.toBe(hashToHue('2024-11-09'));
  });
});

describe('authorAvatarColor', () => {
  it('возвращает hsl(...)', () => {
    expect(authorAvatarColor('userA')).toMatch(/^hsl\(\d+, 60%, 45%\)$/);
  });

  it('совпадает с hashToHue', () => {
    expect(authorAvatarColor('userA')).toBe(`hsl(${hashToHue('userA')}, 60%, 45%)`);
  });
});
