// e2e/core/12-playlist-sharing.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const FIXTURES = {
  'Music/Artist A/Album 1/01 - Track 1.mp3': 'dummy-audio-data-1',
};

test.describe('Playlist Sharing (CUEI1)', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Даем разрешение на клипборд для тестов
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    // Подключаем локальную папку и добавляем трек
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.locator('button[aria-label="Действия"]').click();
    await page.getByText('Добавить в плейлист').click();
    await page.getByText('+ Создать новый').click();
    await page.getByPlaceholder('Название плейлиста').fill('Test Share');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Ждем сохранения в IDB
    await expect
      .poll(async () => {
        const pl = await getIDBValue<any>(page, 'player:playlists');
        return pl?.playlists?.some((p: any) => p.name === 'Test Share');
      })
      .toBe(true);
  });

  test('копирование плейлиста в буфер и импорт обратно', async ({ page }) => {
    // 1. Переходим в плейлист
    await page.goto('/playlists');
    const playlistRow = page.locator('[data-testid^="playlist-row-"]').filter({ hasText: 'Test Share' });
    await playlistRow.click();

    // 2. Открываем меню "Поделиться"
    await page.locator('button[aria-label="Поделиться плейлистом"]').click();

    // Проверяем, что модалка открылась
    await expect(page.getByText('Отправьте плейлист другу:')).toBeVisible();

    // 3. Жмем "Скопировать код"
    await page.getByText('Скопировать код', { exact: true }).click();

    // Проверяем, что модалка закрылась
    await expect(page.getByText('Отправьте плейлист другу:')).toBeHidden();

    // 4. Получаем содержимое буфера
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/^CUEI1:/);

    // 5. Импортируем обратно
    await page.goto('/playlists');
    await page.getByRole('button', { name: 'Импортировать' }).click();

    // Жмем "Вставить из буфера"
    await page.getByText('Вставить из буфера').click();

    // Ждем, пока распознается
    await expect(page.getByText(/Распознан/)).toBeVisible();

    // Импортируем (ищем кнопку именно в модалке, так как в шапке тоже есть "Импортировать")
    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Импорт плейлиста' });
    await modal.getByRole('button', { name: 'Импортировать', exact: true }).click();

    // Проверяем, что плейлист создался
    await expect(page).toHaveURL(/\/playlists\/[^/]+/);
    await expect(page.locator('h1')).toHaveText('Test Share'); // Имя из буфера

    // Проверяем, что трек на месте
    const trackInImport = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackInImport).toBeVisible();
  });
});
