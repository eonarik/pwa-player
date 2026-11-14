// e2e/plugins/21-logii-stream-search.spec.ts

import { test, expect } from '@playwright/test';
import { mockLogii, bootstrapLogii, openLogiiSeason, type DiskItem } from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` }],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'track1.mp3', path: `disk:/${SEASON}/userA/1/track1.mp3`, isAudio: true },
  ],
};

test.describe('Logii: поиск в стримингах', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');
  });

  test('кнопка "Найти в стримингах" открывает модалку', async ({ page }) => {
    await expect(page.getByTestId('logii-stream-search')).toBeVisible();
    await page.getByTestId('logii-stream-search').click();

    await expect(page.getByTestId('stream-search-input')).toBeVisible();
    await expect(page.getByTestId('stream-search-submit')).toBeVisible();
    await expect(page.getByTestId('stream-search-close')).toBeVisible();
  });

  test('закрытие модалки кнопкой X', async ({ page }) => {
    await page.getByTestId('logii-stream-search').click();
    await expect(page.getByTestId('stream-search-input')).toBeVisible();

    await page.getByTestId('stream-search-close').click();
    await expect(page.getByTestId('stream-search-input')).not.toBeVisible();
  });
});
