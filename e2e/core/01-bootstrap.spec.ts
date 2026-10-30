// e2e/01-bootstrap.spec.ts

import { test, expect } from '@playwright/test';
import { waitForAppBootstrap, setupPageLogs } from '../helpers/test-utils';

test.describe('Bootstrap & Home', () => {
  test('приложение загружается, показывает плагины и скрывает лоадер', async ({ page }) => {
    setupPageLogs(page);

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // Ищем по data-testid (добавлен в PluginCard)
    await expect(page.locator('[data-plugin-id="local"]')).toBeVisible();
    await expect(page.locator('[data-plugin-id="radio"]')).toBeVisible();
    await expect(page.locator('[data-plugin-id="podcasts"]')).toBeVisible();

    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme === null || theme === 'default').toBeTruthy();
  });
});
