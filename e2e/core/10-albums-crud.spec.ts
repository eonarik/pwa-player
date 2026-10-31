// e2e/core/10-albums-crud.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const FIXTURES = {
  'Music/Artist A/Album 1/01 - Track 1.mp3': 'dummy-audio-data-1',
};

test.describe('Albums CRUD', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
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

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();
  });

  test('создание нового альбома через ручной ввод', async ({ page }) => {
    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();

    await trackRow.locator('button[aria-label="Действия"]').click();
    await page.getByText('Редактировать вручную').click();

    // Вводим имя альбома напрямую в input (новый альбом)
    const albumInput = page.locator('input[placeholder="Укажите альбом вручную или выберите из списка"]');
    await albumInput.fill('New Test Album');

    await page.getByRole('button', { name: 'Сохранить' }).click();

    // Ждём, что альбом создан в IDB
    await expect
      .poll(
        async () => {
          const albums = await getIDBValue<any>(page, 'player:albums');
          if (!albums) return null;
          return Object.values(albums).some((a: any) => a.name === 'New Test Album');
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // Проверяем, что трек привязан к новому альбому
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          const albums = await getIDBValue<any>(page, 'player:albums');
          if (!lib || !albums) return null;
          const newAlbum = Object.values(albums).find((a: any) => a.name === 'New Test Album') as any;
          if (!newAlbum) return null;
          return Object.values(lib.tracks).some((t: any) => t.albumId === newAlbum.id);
        },
        { timeout: 5000 },
      )
      .toBe(true);
  });
});
