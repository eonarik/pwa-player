// e2e/02-local-plugin.spec.ts

 
import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

const FIXTURES = {
  'Music/Artist A/Album 1/01 - Track 1.mp3': 'dummy-audio-data-1',
  'Music/Artist A/Album 1/02 - Track 2.mp3': 'dummy-audio-data-2',
  'Music/Artist B/03 - Track 3.mp3': 'dummy-audio-data-3',
  'Music/Artist B/cover.jpg': 'dummy-image',
};

test.describe('Local Plugin', () => {
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

  test('подключение папки, сканирование и проверка архитектуры', async ({ page }) => {
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    // Ждем появления папки Music
    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible();
    await musicRow.click();

    // Ждем Artist A и Artist B
    const artistARow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await expect(artistARow).toBeVisible();
    await artistARow.click();

    // Ждем Album 1
    const albumRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await expect(albumRow).toBeVisible();
    await albumRow.click();

    // Ждем Track 1 и Track 2 (добавляем .first(), чтобы взять саму строку, а не вложенный span)
    const track1 = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Track 1' }).first();
    await expect(track1).toBeVisible();

    // Ждем сохранения в IDB
    await expect
      .poll(
        async () => {
          return await getIDBValue<any>(page, 'player:library:local');
        },
        { timeout: 5000 },
      )
      .not.toBeNull();

    const persisted = await getIDBValue<any>(page, 'player:library:local');
    expect(persisted.folders).toBeDefined();
    expect(persisted.tracks).toBeDefined();

    const trackTitles = persisted.tracks.map((t: any) => t.title);
    expect(trackTitles).toContain('Track 1');
    expect(trackTitles).toContain('Track 2');
  });
});
