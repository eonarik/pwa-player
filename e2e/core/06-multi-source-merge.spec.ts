// e2e/core/06-multi-source-merge.spec.ts

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockFileSystem } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mp3Buffer = fs.readFileSync(path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3'));
const mp3Uint8 = new Uint8Array(mp3Buffer);

const FIXTURES = {
  'Album1/Artist A - Track 1.mp3': mp3Uint8,
  'Album2/Artist A - Track 1.mp3': mp3Uint8,
};

test.describe('Core: Склейка треков из разных папок', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

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

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();
  });

  test('один трек из двух разных папок склеивается в один Track с двумя sources', async ({ page }) => {
    // 1. Дожидаемся, пока папки Album1 и Album2 появятся и отсканируются
    // (в локальном плагине сканирование идет сразу, но нужно время)
    const album1Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album1' });
    const album2Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album2' });

    await expect(album1Row).toBeVisible();
    await expect(album2Row).toBeVisible();

    // Ждем, пока у них появится текст с треками (не "Ожидает сканирования")
    await expect(album1Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });
    await expect(album2Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });

    // 2. Проверяем в IndexedDB, что это ОДИН трек с ДВУМЯ источниками
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;

          const tracks = Object.values(lib.tracks) as any[];

          // Нас интересует трек с названием "Track 1" (он должен быть один)
          const targetTracks = tracks.filter((t) => t.title === 'Track 1');

          if (targetTracks.length !== 1) return `expected 1 track, found ${targetTracks.length}`;

          const track = targetTracks[0];
          return track.sources.length;
        },
        { timeout: 5000 },
      )
      .toBe(2); // Ожидаем, что у трека 2 источника
  });
});
