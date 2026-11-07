// e2e/plugins/22-logii-tops.spec.ts

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
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [],
};

test.describe('Logii: топы (создание, переименование, удаление)', () => {
  test('полный цикл', async ({ page }) => {
    const { diskTree } = await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    // Автовыбор автора — мы на /userA (папок нет, Intro нет).
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08\/userA$/);

    // --- 1. Создание ---
    await page.getByTestId('tops-create').click();
    await page.getByTestId('create-tops-submit').click();

    await expect
      .poll(
        async () => {
          const folders = await readLibraryFolders(page);
          if (!folders) return 0;
          return folders.filter((f) => f.parentId !== null && /^\d+$/.test(f.name)).length;
        },
        { timeout: 10000 },
      )
      .toBe(20);

    expect(diskTree[`${SEASON}/userA`].some((i) => i.name === 'intro.txt')).toBe(true);

    await expect(page.getByTestId('logii-folder-1')).toBeVisible();
    await expect(page.getByTestId('logii-folder-20')).toBeVisible();

    // --- 2. Переименование топа "1" ---
    await page.getByTestId('folder-row-1').hover();
    await page.getByTestId('folder-rename-1').click();

    const input = page.getByTestId('create-folder-input');
    await input.fill('intro-top');
    await page.getByTestId('create-folder-submit').click();

    await expect
      .poll(
        async () => {
          const folders = await readLibraryFolders(page);
          return {
            has1: folders?.some((f) => f.name === '1'),
            hasIntroTop: folders?.some((f) => f.name === 'intro-top'),
          };
        },
        { timeout: 5000 },
      )
      .toEqual({ has1: false, hasIntroTop: true });

    await expect(page.getByTestId('logii-folder-intro-top')).toBeVisible();
    await expect(page.getByTestId('logii-folder-1')).toHaveCount(0);

    // --- 3. Удаление топа "intro-top" ---
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('folder-row-intro-top').hover();
    await page.getByTestId('folder-delete-intro-top').click();

    await expect
      .poll(async () => (await readLibraryFolders(page))?.some((f) => f.name === 'intro-top'), { timeout: 5000 })
      .toBe(false);

    await expect(page.getByTestId('logii-folder-intro-top')).toHaveCount(0);
    expect(diskTree[`${SEASON}/userA`].some((i) => i.name === 'intro-top')).toBe(false);
  });
});
