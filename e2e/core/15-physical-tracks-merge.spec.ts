// e2e/core/15-physical-tracks-merge.spec.ts

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mp3Buffer = fs.readFileSync(path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3'));
const mp3Uint8 = new Uint8Array(mp3Buffer);

/**
 * Artist A — Track 1 (Album1) и Artist A — Track 2 (Album2).
 * Одинаковый артист, разные title (не подстрока) → mergeMany создаёт 2 separate created трека.
 * Но! mergeMany обрабатывает payload одновременно, инdex пустой — оба created.
 * Нет дублей из-за разных title.
 *
 * Нужно: одинаковый артист + title, разный source/folder → merged-strict (2 sources, 1 track).
 * Или: одинаковый артист + title с подстрокой → soft → linked-duplicate.
 *
 * Используем: Artist A — Track 1 (Album1) и Artist A — Track 1.mp3 (Album2) → одинаковые title.
 * mergeMany: первый payload → created (track #1). Второй payload → merge по индексу
 * "artist a" → strict match (title одинаковый) → merged-strict (1 трек, 2 sources).
 *
 * Для linked-duplicate нужен merge из разных плагинов (последовательные вызовы).
 * Для local — merged-strict, потому что mergeMany обрабатывает всё разом.
 *
 * Значит 15-тест проверяет merged-strict (одинаковые artist/title → 1 track, 2 sources).
 */
const FIXTURES = {
  'Album1/Artist A - Track 1.mp3': mp3Uint8,
  'Album2/Artist A - Track 1.mp3': mp3Uint8,
};

declare global {
  interface Window {
    __library?: any;
    __playlists?: any;
  }
}

test.describe('Core: Склейка физических треков (merged-strict)', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        Object.defineProperty(this, 'paused', { value: false, configurable: true });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('player:uiSettings', JSON.stringify({ autoFetchMetadata: false }));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    // Подключаем local — mergeMany склеит два трека в один (merged-strict).
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByTestId('plugin-connect').click();
  });

  test('одинаковые artist/title в разных папках → merged-strict (1 track, 2 sources)', async ({ page }) => {
    // IDB: 1 трек, 2 sources (merged-strict из mergeMany)
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const targetTracks = tracks.filter((t) => t.title === 'Track 1');
          if (targetTracks.length !== 1) return `expected 1 track, found ${targetTracks.length}`;
          return targetTracks[0].sources.length;
        },
        { timeout: 5000 },
      )
      .toBe(2);

    // Оба folder.trackIds содержат склеенный трек
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.folders) return null;
          const folderA = Object.values(lib.folders).find((f: any) => f.name === 'Album1') as any;
          const folderB = Object.values(lib.folders).find((f: any) => f.name === 'Album2') as any;
          if (!folderA || !folderB) return null;
          const shared = folderA.trackIds.filter((id: string) => folderB.trackIds.includes(id));
          return { folderA: folderA.trackIds.length, folderB: folderB.trackIds.length, shared: shared.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ folderA: 1, folderB: 1, shared: 1 });
  });
});
