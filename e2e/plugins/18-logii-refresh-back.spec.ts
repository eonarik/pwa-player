// e2e/plugins/18-logii-refresh-back.spec.ts

import { test, expect } from '@playwright/test';
import { mockLogii, bootstrapLogii, openLogiiSeason, openAuthor, openFolder, type DiskItem } from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [
    { type: 'dir', name: 'Music', path: 'disk:/Music' },
    { type: 'dir', name: SEASON, path: `disk:/${SEASON}` },
  ],
  Music: [{ type: 'dir', name: SEASON, path: `disk:/Music/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` }],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'track1.mp3', path: `disk:/${SEASON}/userA/1/track1.mp3`, isAudio: true },
    { type: 'file', name: 'vibe.logii.txt', path: `disk:/${SEASON}/userA/1/vibe.logii.txt` },
  ],
  [`Music/${SEASON}`]: [{ type: 'dir', name: 'userC', path: `disk:/Music/${SEASON}/userC` }],
  [`Music/${SEASON}/userC`]: [{ type: 'dir', name: '1', path: `disk:/Music/${SEASON}/userC/1` }],
  [`Music/${SEASON}/userC/1`]: [
    { type: 'file', name: 'trackC1.mp3', path: `disk:/Music/${SEASON}/userC/1/trackC1.mp3`, isAudio: true },
  ],
};

test.describe('Logii: "К папкам"', () => {
  test('из сезона в корне → корень yandex-self (FolderView)', async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);

    await openLogiiSeason(page, '2024-11-08');
    await expect(page).toHaveURL(new RegExp(`/folder/yandex-self/${SEASON.replace('.', '\\.')}$`));

    await page.getByRole('button', { name: 'К папкам' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/?$/);
  });

  test('из сезона во вложенной папке Music → Music', async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);

    // Входим в Music, потом в сезон
    await page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' }).click();
    await openLogiiSeason(page, '2024-11-08');
    await expect(page).toHaveURL(new RegExp(`/folder/yandex-self/Music/${SEASON.replace('.', '\\.')}$`));

    await page.getByRole('button', { name: 'К папкам' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/Music$/);
  });
});

test.describe('Logii: refresh (обновление состава папок)', () => {
  test('после refresh появляется новая папка/трек и исчезает удалённая', async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);

    await openLogiiSeason(page, '2024-11-08');
    await openAuthor(page, 'userA');
    await openFolder(page, '1');

    // Мутируем мок: удаляем папку "1", добавляем папку "2" с треком
    const mutated: Record<string, DiskItem[]> = {
      ...TREE,
      [`${SEASON}/userA`]: [{ type: 'dir', name: '2', path: `disk:/${SEASON}/userA/2` }],
      [`${SEASON}/userA/2`]: [
        { type: 'file', name: 'track2.mp3', path: `disk:/${SEASON}/userA/2/track2.mp3`, isAudio: true },
      ],
    };
    await page.unroute('**/api/yandex-self/resources**');
    await mockLogii(page, { diskTree: mutated });

    // Жмём refresh. Текущая папка "1" исчезла → должны уйти на userA
    await page.getByRole('button', { name: 'Обновить с облака' }).click();

    await expect(page).toHaveURL(new RegExp(`/folder/yandex-self/${SEASON.replace('.', '\\.')}/userA$`));
    await expect(page.getByTestId('logii-folder-2')).toBeVisible();
    await expect(page.getByTestId('logii-folder-1')).toHaveCount(0);
  });
});

test.describe('Logii: редактирование vibe', () => {
  test('изменение текста vibe сохраняется', async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);

    await openLogiiSeason(page, '2024-11-08');
    await openAuthor(page, 'userA');
    await openFolder(page, '1');

    // Кнопка "Редактировать" (если vibe пустой — "Написать"; в моке vibe не пустой)
    await page.getByRole('button', { name: 'Редактировать' }).click();

    const textarea = page.locator('textarea').first();
    await textarea.fill('Новый текст вайба');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    // Проверяем, что текст обновился в DOM
    await expect(page.getByText('Новый текст вайба')).toBeVisible();
  });
});
