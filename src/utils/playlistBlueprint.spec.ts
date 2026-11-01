// src/utils/playlistBlueprint.spec.ts

import { describe, it, expect } from 'vitest';
import { encodeBlueprint, decodeBlueprint, type BlueprintData } from './playlistBlueprint';

describe('playlistBlueprint', () => {
  const sampleData: BlueprintData = {
    n: 'Мой плейлист',
    tr: [
      { a: 'Radiohead', t: 'Creep', al: 'Pablo Honey', d: 238 },
      { a: 'Muse', t: 'Supermassive Black Hole', al: 'Black Holes and Revelations', d: 210 },
    ],
  };

  it('сжимает и разжимает без потерь', async () => {
    const encoded = await encodeBlueprint(sampleData);
    expect(encoded).toMatch(/^CUEI1:/);
    // Base64URL не должен содержать +, /, =
    expect(encoded).not.toMatch(/[+/=]/);

    const decoded = await decodeBlueprint(encoded);
    expect(decoded).toEqual(sampleData);
  });

  it('сжимает большие списки (кириллица)', async () => {
    const bigData: BlueprintData = {
      n: 'Очень длинный плейлист',
      tr: Array.from({ length: 100 }).map((_, i) => ({
        a: `Исполнитель ${i}`,
        t: `Трек номер ${i}`,
        al: `Альбом ${i}`,
        d: 180 + i,
      })),
    };

    const encoded = await encodeBlueprint(bigData);
    expect(encoded.length).toBeLessThan(5000);

    const decoded = await decodeBlueprint(encoded);
    expect(decoded?.tr).toHaveLength(100);
    expect(decoded?.tr[0]?.a).toBe('Исполнитель 0');
  });

  it('возвращает null для неверного префикса', async () => {
    expect(await decodeBlueprint('INVALID:data')).toBeNull();
  });

  it('возвращает null для битой Base64', async () => {
    expect(await decodeBlueprint('CUEI1:invalid-base64---')).toBeNull();
  });
});
