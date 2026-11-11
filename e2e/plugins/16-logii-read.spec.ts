// e2e/plugins/16-logii-read.spec.ts

import { test, expect } from '@playwright/test';
import {
  mockLogii,
  bootstrapLogii,
  openLogiiSeason,
  openAuthor,
  openFolder,
  clickTab,
  type DiskItem,
} from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [
    { type: 'dir', name: 'Обычная папка', path: 'disk:/Обычная папка' },
    { type: 'dir', name: SEASON, path: `disk:/${SEASON}` },
  ],
  'Обычная папка': [],
  [SEASON]: [
    { type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` },
    { type: 'dir', name: 'userB', path: `disk:/${SEASON}/userB` },
  ],
  [`${SEASON}/userA`]: [
    { type: 'file', name: 'intro.logii.txt', path: `disk:/${SEASON}/userA/intro.logii.txt` },
    { type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` },
  ],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'track1.mp3', path: `disk:/${SEASON}/userA/1/track1.mp3`, isAudio: true },
    { type: 'file', name: 'vibe.logii.txt', path: `disk:/${SEASON}/userA/1/vibe.logii.txt` },
    { type: 'file', name: 'cover.jpg', path: `disk:/${SEASON}/userA/1/cover.jpg` },
  ],
  [`${SEASON}/userB`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userB/1` }],
  [`${SEASON}/userB/1`]: [
    { type: 'file', name: 'track2.mp3', path: `disk:/${SEASON}/userB/1/track2.mp3`, isAudio: true },
  ],
};

test.describe('Logii: read-only (навигация + intro + vibe + чат + галерея)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
  });

  test('вход в сезон → авторы; в авторе → топы и intro; intro содержит текст', async ({ page }) => {
    // В корне yandex-self — обычная папка и сезон
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Обычная папка' })).toBeVisible();
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: '2024-11-08' })).toBeVisible();

    // Входим в сезон
    await openLogiiSeason(page, '2024-11-08');
    await expect(page).toHaveURL(new RegExp(`/folder/yandex-self/${SEASON.replace('.', '\\.')}$`));

    // Авторы видны
    await expect(page.getByText('userA', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('userB', { exact: true }).first()).toBeVisible();

    // Входим к userA
    await openAuthor(page, 'userA');
    await expect(page).toHaveURL(new RegExp(`/folder/yandex-self/${SEASON.replace('.', '\\.')}/userA$`));

    // Intro (имя файла) и топ-папка "1" видны в колонке 2
    await expect(page.getByText('intro.logii.txt', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

    // Клик на intro → отображается текст intro (в табе "Трек")
    await page.getByText('intro.logii.txt', { exact: true }).first().click();
    await expect(page.getByText('Добро пожаловать в мой уголок')).toBeVisible();
  });

  test('чат в intro содержит комментарии intro', async ({ page }) => {
    await openLogiiSeason(page, '2024-11-08');
    await openAuthor(page, 'userA');
    await page.getByText('intro.logii.txt', { exact: true }).first().click();

    // В intro-режиме табы не рендерятся (LogiiPanel.vue: `v-if="!isIntro"`).
    // Чат встроен в LogiiIntroView — проверяем комментарии напрямую.
    await expect(page.getByText('Привет!')).toBeVisible();
    await expect(page.getByText('Первый комментарий')).toHaveCount(0);
  });

  test('топ содержит трек и vibe; чат топа — комментарии vibe; галерея — картинки', async ({ page }) => {
    await openLogiiSeason(page, '2024-11-08');
    await openAuthor(page, 'userA');
    await openFolder(page, '1');

    // Таб "Трек" по умолчанию — видим vibe и трек
    await expect(page.getByText('Вайб трека')).toBeVisible();
    await expect(page.getByText('track1', { exact: false })).toBeVisible();

    // Чат
    await clickTab(page, 'Чат');
    await expect(page.getByText('Первый комментарий')).toBeVisible();
    await expect(page.getByText('Привет!')).toHaveCount(0);

    // Галерея
    await clickTab(page, 'Галерея');
    await expect(page.getByTestId('logii-gallery-image-0')).toBeVisible();
  });
});
