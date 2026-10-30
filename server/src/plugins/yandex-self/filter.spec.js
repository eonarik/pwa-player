// server/src/plugins/yandex-self/filter.spec.js

import { describe, it, expect } from 'vitest';
import { mapAndFilterItems, normalizePath, isAudioFile } from './filter.js';

describe('yandex-self filter', () => {
  describe('isAudioFile', () => {
    it('распознает аудио', () => {
      expect(isAudioFile('song.mp3')).toBe(true);
      expect(isAudioFile('song.MP3')).toBe(true);
      expect(isAudioFile('song.flac')).toBe(true);
    });
    it('игнорирует не аудио', () => {
      expect(isAudioFile('song.txt')).toBe(false);
      expect(isAudioFile('folder')).toBe(false);
    });
  });

  describe('mapAndFilterItems', () => {
    it('добавляет isAudio и не фильтрует, если allowedFolders = null', () => {
      const items = [
        { name: 'song.mp3', type: 'file' },
        { name: 'doc.txt', type: 'file' },
        { name: 'folder', type: 'dir' },
      ];
      const result = mapAndFilterItems(items, '/', null);
      expect(result).toHaveLength(3);
      expect(result[0].isAudio).toBe(true);
      expect(result[1].isAudio).toBe(false);
    });

    it('фильтрует по allowedFolders (корень)', () => {
      const items = [
        { name: 'Flёur', type: 'dir' },
        { name: 'nostalgy', type: 'dir' },
        { name: 'other', type: 'dir' },
      ];
      const result = mapAndFilterItems(items, '/', ['/Flёur', '/nostalgy']);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.name)).toEqual(['Flёur', 'nostalgy']);
    });

    it('фильтрует по allowedFolders (внутри папки)', () => {
      const items = [
        { name: 'song.mp3', type: 'file' },
        { name: 'other.txt', type: 'file' },
      ];
      const result = mapAndFilterItems(items, '/Flёur', ['/Flёur']);
      expect(result).toHaveLength(2); // Оба файла внутри разрешенной папки
    });

    it('фильтрует родителя разрешенной папки', () => {
      const items = [{ name: 'Flёur', type: 'dir' }];
      const result = mapAndFilterItems(items, '/', ['/Flёur/Апьбомы']);
      expect(result).toHaveLength(1); // Папка Flёur — родитель, должна быть видна
    });
  });

  describe('normalizePath', () => {
    it('убирает disk: и хвостовые слэши', () => {
      expect(normalizePath('disk:/music/', '/root').path).toBe('/music');
    });

    it('вырезает root из пути', () => {
      const result = normalizePath('/root/music', '/root');
      expect(result.path).toBe('/music');
      expect(result.cleanRoot).toBe('/root');
    });

    it('корректно склеивает', () => {
      const result = normalizePath('/music', '/root/');
      expect(result.path).toBe('/music');
      expect(result.cleanRoot).toBe('/root');
    });

    it('возвращает / для корня', () => {
      expect(normalizePath('/', '/root').path).toBe('/');
      expect(normalizePath('/root', '/root').path).toBe('/');
    });
  });
});
