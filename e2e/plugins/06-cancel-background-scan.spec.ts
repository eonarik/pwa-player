// e2e/08-cancel-background-scan.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

test.describe('Yandex Disk: Отмена фонового сканирования', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Мокаем API так, чтобы сканирование Artist A было ОЧЕНЬ медленным (10 секунд)
    // чтобы мы успели нажать "Отменить"
    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path');

      if (path === '/' || path === 'disk:/') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ type: 'dir', name: 'Artist A', path: 'disk:/Artist A' }],
          }),
        });
      }

      if (path === '/Artist A' || path === 'disk:/Artist A') {
        // Искусственная задержка 10 секунд
        await new Promise((r) => setTimeout(r, 10000));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      }

      return route.fulfill({ status: 404, body: 'Not found' });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    const diskCard = page.locator('[data-plugin-id="yandex"]');
    await diskCard.getByRole('button', { name: 'Подключить' }).click();
  });

  test('отменяет фоновый скан и переводит папки в статус ошибки', async ({ page }) => {
    const artistFolderRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });

    // 1. Ждем, пока папка появится и начнется синхронизация
    await expect(artistFolderRow).toBeVisible();
    await expect(artistFolderRow.getByText('Синхронизация...')).toBeVisible();

    // 2. Открываем меню синхронизации (кнопка обновления)
    await page.locator('button[aria-label="Синхронизация"]').click();

    // 3. Нажимаем "Отменить синхронизацию"
    await page.getByText('Отменить синхронизацию').click();

    // 4. Проверяем, что статус сменился на "Ошибка синхронизации"
    await expect(artistFolderRow.getByText('Ошибка синхронизации')).toBeVisible();
  });
});
