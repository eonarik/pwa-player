// e2e/core/03-offline-cache.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

const FIXTURES = {
  'Music/Artist A/Album 1/01 - Track 1.mp3': 'dummy-audio-data-1',
};

test.describe('Core: Офлайн-восстановление', () => {
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
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);
  });

  test('восстанавливает локальную библиотеку при отказе API', async ({ page }) => {
    // 1. Подключаем локальную папку и сканируем
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible();
    await musicRow.click();

    const artistRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await expect(artistRow).toBeVisible();
    await artistRow.click();

    const albumRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await expect(albumRow).toBeVisible();
    await albumRow.click();

    const track1 = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Track 1' }).first();
    await expect(track1).toBeVisible();

    // 2. Ждем сохранения в IndexedDB
    await expect
      .poll(async () => {
        return await page.evaluate(async () => {
          return new Promise((resolve) => {
            const req = indexedDB.open('keyval-store');
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('keyval', 'readonly');
              const getReq = tx.objectStore('keyval').get('player:library');
              getReq.onsuccess = () => resolve(!!getReq.result);
            };
          });
        });
      })
      .toBe(true);

    // 3. Симулируем падение API для конкретных эндпоинтов
    await page.route('**/api/disk/resources**', (route) => route.abort('failed'));
    await page.route('**/api/track-metadata**', (route) => route.abort('failed'));

    // 4. Перезагружаем страницу
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // 5. Проверяем, что мы остались в той же папке и трек на месте
    // (роут сохраняется в URL, поэтому мы сразу внутри Album 1)
    await expect(track1).toBeVisible();

    // Снимаем блокировку API
    await page.unroute('**/api/disk/resources**');
    await page.unroute('**/api/track-metadata**');
  });
});
