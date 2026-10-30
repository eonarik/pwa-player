// e2e/plugins/07-yandex-progressive.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

test.describe('Yandex Disk: Прогрессивный рендеринг', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ authenticated: true }) }),
    );

    // Мокаем API Диска
    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path');

      // Корень
      if (path === '/' || path === 'disk:/') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ type: 'dir', name: 'Music', path: 'disk:/Music' }],
          }),
        });
      }

      // Папка Music (отдается с задержкой 1 секунда)
      if (path === '/Music' || path === 'disk:/Music') {
        await new Promise((r) => setTimeout(r, 1000));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              { type: 'dir', name: 'A1', path: 'disk:/Music/A1' },
              { type: 'dir', name: 'A2', path: 'disk:/Music/A2' },
              { type: 'dir', name: 'A3', path: 'disk:/Music/A3' },
            ],
          }),
        });
      }

      // Вложенная папка A1 (отдается с огромной задержкой 10 секунд)
      if (path === '/Music/A1' || path === 'disk:/Music/A1') {
        await new Promise((r) => setTimeout(r, 10000));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      }

      // Остальные папки пустые
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
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

  test('показывает папки внутри Music сразу после их получения, не дожидаясь конца скана', async ({ page }) => {
    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible();

    // Кликаем на Music (она начнет сканироваться, API займет 1 секунду)
    await musicRow.click({ force: true });

    // Проверяем, что A1, A2, A3 появились в UI (благодаря onChunk)
    const a1Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'A1' });
    const a2Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'A2' });

    await expect(a1Row).toBeVisible({ timeout: 4000 });
    await expect(a2Row).toBeVisible({ timeout: 4000 });

    // ВОЗВРАЩАЕМСЯ ОБРАТНО К КОРНЮ
    await page.goBack();

    // Теперь Music должна показывать "Синхронизация...", так как внутри всё еще висит A1 (10 сек)
    // Мы не ждем 10 секунд, а сразу проверяем, что статус не "пусто", а "Синхронизация..."
    await expect(musicRow.getByText('Синхронизация...')).toBeVisible();
  });
});
