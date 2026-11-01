// e2e/core/13-clipboard-watcher.spec.ts

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';

test.describe('Clipboard Watcher', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('показывает тост при наличии CUEI1 в буфере', async ({ page }) => {
    // 1. Кладем текст в буфер
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('CUEI1:dummyencoded');
    });

    // 2. Фокусируем страницу (эмулируем возврат на вкладку)
    await page.bringToFront();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    // 3. Ждем тост
    const toast = page.locator('[role="status"]').filter({ hasText: 'В буфере найден плейлист' });
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('не показывает тост при обычном тексте в буфере', async ({ page }) => {
    await page.evaluate(async () => {
      await navigator.clipboard.writeText('just some text');
    });

    await page.bringToFront();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });

    const toast = page.locator('[role="status"]').filter({ hasText: 'В буфере найден плейлист' });
    await expect(toast).toBeHidden();
  });
});
