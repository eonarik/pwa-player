// e2e/plugins/21-logii-authors.spec.ts

import { test, expect } from '@playwright/test';
import {
  mockLogii,
  bootstrapLogii,
  openLogiiSeason,
  readLibraryFolders,
  type DiskItem,
} from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [],
};

test.describe('Logii: авторы (создание, переименование, удаление)', () => {
  test('полный цикл', async ({ page }) => {
    const { diskTree } = await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    // --- 1. Создание ---
    await page.getByTestId('author-add').click();
    await page.getByTestId('create-folder-input').fill('authorX');
    await page.getByTestId('create-folder-submit').click();

    await expect
      .poll(async () => (await readLibraryFolders(page))?.some((f) => f.name === 'authorX'), { timeout: 5000 })
      .toBe(true);

    await expect(page.getByTestId('author-row-authorX')).toBeVisible();

    // --- 2. Переименование ---
    await page.getByTestId('author-row-authorX').hover();
    await page.getByTestId('author-rename-authorX').click();

    const input = page.getByTestId('create-folder-input');
    await input.fill('authorY');
    await page.getByTestId('create-folder-submit').click();

    await expect
      .poll(
        async () => {
          const folders = await readLibraryFolders(page);
          return {
            hasOld: folders?.some((f) => f.name === 'authorX'),
            hasNew: folders?.some((f) => f.name === 'authorY'),
          };
        },
        { timeout: 5000 },
      )
      .toEqual({ hasOld: false, hasNew: true });

    await expect(page.getByTestId('author-row-authorY')).toBeVisible();
    await expect(page.getByTestId('author-row-authorX')).toHaveCount(0);

    // --- 3. Удаление ---
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('author-row-authorY').hover();
    await page.getByTestId('author-delete-authorY').click();

    await expect
      .poll(async () => (await readLibraryFolders(page))?.some((f) => f.name === 'authorY'), { timeout: 5000 })
      .toBe(false);

    await expect(page.getByTestId('author-row-authorY')).toHaveCount(0);
    expect(diskTree[SEASON].some((i) => i.name === 'authorY')).toBe(false);
  });
});
