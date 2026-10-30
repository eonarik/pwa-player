// e2e/05-zvuk-plugin.spec.ts

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';

test.describe('Zvuk Plugin', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
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
  });

  test('поиск трека в СберЗвуке', async ({ page }) => {
    const zvukCard = page.locator('[data-plugin-id="zvuk"]');
    await zvukCard.getByRole('button', { name: 'Открыть' }).click();

    await expect(page.getByPlaceholder('Что ищем?')).toBeVisible();

    // Ждем ответа от API Звука
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/zvuk/search'));

    await page.getByPlaceholder('Что ищем?').fill('muse');
    await responsePromise;

    // Ждем появления результатов
    await expect(page.getByText('Test Zvuk Track')).toBeVisible();
  });
});
