// server/src/plugins/yandex-self/filter.spec.js

import { describe, it, expect } from 'vitest';
import { mapAndFilterItems, normalizePath, isAudioFile, stripCleanRoot } from './filter.js';

describe('yandex-self filter (BFF Normalization)', () => {
  const cleanRoot = '/все,что наше/Логии';

  describe('normalizePath', () => {
    it('нормализует корень', () => {
      expect(normalizePath('/', cleanRoot).path).toBe('/');
    });
    it('нормализует вложенный путь', () => {
      expect(normalizePath('/Flёur', cleanRoot).path).toBe('/Flёur');
    });
  });

  describe('stripCleanRoot (для корневого объекта ответа)', () => {
    it('отрезает disk: и cleanRoot, возвращая "/"', () => {
      // Яндекс возвращает полный путь корня
      expect(stripCleanRoot('disk:/все,что наше/Логии', cleanRoot)).toBe('/');
    });

    it('отрезает disk: и cleanRoot, возвращая вложенный путь', () => {
      expect(stripCleanRoot('disk:/все,что наше/Логии/Flёur', cleanRoot)).toBe('/Flёur');
    });

    it('корректно работает с лишними слэшами', () => {
      expect(stripCleanRoot('disk:/все,что наше/Логии/', cleanRoot)).toBe('/');
    });
  });

  describe('mapAndFilterItems (для массива items)', () => {
    const yandexItems = [
      { name: 'Flёur', path: 'disk:/все,что наше/Логии/Flёur', type: 'dir' },
      { name: 'nostalgy', path: 'disk:/все,что наше/Логии/nostalgy', type: 'dir' },
      { name: 'song.mp3', path: 'disk:/все,что наше/Логии/song.mp3', type: 'file' },
    ];

    it('отрезает disk: и cleanRoot у элементов', () => {
      const result = mapAndFilterItems(yandexItems, '/', null, cleanRoot);

      expect(result).toHaveLength(3);
      // Пути должны быть ОТНОСИТЕЛЬНЫМИ (без ведущего слэша)
      expect(result[0].path).toBe('Flёur');
      expect(result[1].path).toBe('nostalgy');
      expect(result[2].path).toBe('song.mp3');
    });

    it('корректно фильтрует по allowedFolders', () => {
      const result = mapAndFilterItems(yandexItems, '/', ['/Flёur'], cleanRoot);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Flёur');
    });

    it('игнорирует пробелы и регистр в cleanRoot', () => {
      // Симулируем ситуацию, когда в .env есть лишние пробелы
      const noisyRoot = ' /все,что наше/Логии/ ';
      const result = mapAndFilterItems(yandexItems, '/', null, noisyRoot);

      expect(result[0].path).toBe('Flёur');
    });
  });
});
