// e2e/plugins/19-logii-comments.spec.ts

import { test, expect } from '@playwright/test';
import { mockLogii, bootstrapLogii, openLogiiSeason, clickTab, type DiskItem } from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` }],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'track1.mp3', path: `disk:/${SEASON}/userA/1/track1.mp3`, isAudio: true },
    { type: 'file', name: 'vibe.logii.txt', path: `disk:/${SEASON}/userA/1/vibe.logii.txt` },
  ],
};

test.describe('Logii: комментарии', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');
    await clickTab(page, 'Чат');
  });

  test('редактирование комментария', async ({ page }) => {
    await page.getByTestId('logii-comment-0').hover();
    await page.getByTestId('logii-comment-edit-0').click();

    await page.getByTestId('logii-comment-edit-input').fill('Изменённый текст');
    await page.getByTestId('logii-comment-save').click();

    await expect(page.getByTestId('logii-comment-0')).toContainText('Изменённый текст');
  });

  test('удаление комментария', async ({ page }) => {
    await page.getByTestId('logii-comment-0').hover();
    await page.getByTestId('logii-comment-delete-0').click();

    await expect(page.getByTestId('logii-comment-0')).toHaveCount(0);
  });
});
