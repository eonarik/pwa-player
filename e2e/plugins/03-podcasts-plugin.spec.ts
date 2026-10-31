// e2e/04-podcasts-plugin.spec.ts

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

test.describe('Podcasts Plugin', () => {
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

  test('добавление подкаста по RSS-ссылке', async ({ page }) => {
    const podcastsCard = page.locator('[data-plugin-id="podcasts"]');
    await podcastsCard.getByRole('button', { name: 'Открыть' }).click();

    await expect(page.getByText('Мои подкасты').first()).toBeVisible();

    await page.getByRole('button', { name: 'По ссылке' }).click();
    await page.getByPlaceholder('https://example.com/podcast/feed.xml').fill('https://example.com/feed.xml');

    // Ждем ответа от прокси (мок отдает XML)
    const responsePromise = page.waitForResponse((response) => response.url().includes('/api/podcasts/proxy'));

    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    await responsePromise;

    // Ждем появления подкаста в списке
    await expect(page.getByText('Test Podcast').first()).toBeVisible();

    // Ждем сохранения в IDB через getIDBValue
    await expect
      .poll(
        async () => {
          return await getIDBValue<any>(page, 'podcasts:subscriptions');
        },
        { timeout: 5000 },
      )
      .not.toBeNull();

    const subscriptions = await getIDBValue<any>(page, 'podcasts:subscriptions');
    expect(subscriptions.subscriptions).toHaveLength(1);
    expect(subscriptions.subscriptions[0].podcast.title).toBe('Test Podcast');
  });
});
