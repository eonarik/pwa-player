// e2e/plugins/24-logii-gallery.spec.ts

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockLogii, bootstrapLogii, openLogiiSeason, clickTab, type DiskItem } from '../helpers/logii-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Будем использовать mp3 как «валидную картинку» для мока загрузки.
// Реальный content-type задаётся в mockLogii (см. ниже).
const mp3Path = path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3');

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` }],
  [`${SEASON}/userA/1`]: [],
};

test.describe('Logii: галерея (загрузка/удаление)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    // Автовыбор автора + папки "1".
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08\/userA\/1$/);

    // Переключаемся на таб «Галерея».
    await clickTab(page, 'Галерея');
  });

  test('загрузка картинки — появляется в галерее', async ({ page }) => {
    // Изначально галерея пуста.
    await expect(page.getByText('Картинок нет')).toBeVisible();

    // Загружаем картинку (mp3 как «картинка» — тип не важен для мока).
    await page.getByTestId('logii-gallery-upload-input').setInputFiles({
      name: 'image1.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(mp3Path),
    });

    // Появляется картинка (обёртка).
    await expect(page.getByTestId('logii-gallery-image-0')).toBeVisible({ timeout: 10000 });

    // Кнопка «Удалить» появляется при hover.
    await page.getByTestId('logii-gallery-image-0').hover();
    await expect(page.getByTestId('logii-gallery-delete-0')).toBeVisible();
  });

  test('удаление картинки — пропадает из галереи', async ({ page }) => {
    // 1. Загружаем
    await page.getByTestId('logii-gallery-upload-input').setInputFiles({
      name: 'image1.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(mp3Path),
    });
    await expect(page.getByTestId('logii-gallery-image-0')).toBeVisible({ timeout: 10000 });

    // 2. Удаляем
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('logii-gallery-image-0').hover();
    await page.getByTestId('logii-gallery-delete-0').click();

    // 3. Картинка пропала, галерея пуста.
    await expect(page.getByTestId('logii-gallery-image-0')).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText('Картинок нет')).toBeVisible();
  });

  test('загрузка двух картинок — обе появляются, удаление одной оставляет другую', async ({ page }) => {
    // Загружаем одну и ту же mp3 дважды с разными именами.
    // setInputFiles не даёт переименовать, но мы можем скормить массив.
    const secondPath = path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3');

    await page.getByTestId('logii-gallery-upload-input').setInputFiles([
      { name: 'image1.png', mimeType: 'image/png', buffer: fs.readFileSync(mp3Path) },
      { name: 'image2.png', mimeType: 'image/png', buffer: fs.readFileSync(secondPath) },
    ]);

    await expect(page.getByTestId('logii-gallery-image-0')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('logii-gallery-image-1')).toBeVisible({ timeout: 10000 });

    // Удаляем первую.
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('logii-gallery-image-0').hover();
    await page.getByTestId('logii-gallery-delete-0').click();

    // Вторая осталась, первая пропала.
    await expect(page.getByTestId('logii-gallery-image-0')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('logii-gallery-image-1')).toHaveCount(0);
  });
});
