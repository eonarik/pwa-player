// e2e/plugins/23-logii-upload-track.spec.ts

import { test, expect } from '@playwright/test';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockLogii, bootstrapLogii, openLogiiSeason, type DiskItem } from '../helpers/logii-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mp3Path = path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3');

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [{ type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` }],
  [`${SEASON}/userA`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` }],
  [`${SEASON}/userA/1`]: [],
};

test.describe('Logii: загрузка/удаление треков', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    // Автовыбор автора + папки "1".
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08\/userA\/1$/);
  });

  test('загрузка трека — появляется в списке треков', async ({ page }) => {
    await page.getByTestId('logii-upload-input').setInputFiles(mp3Path);

    // Трек виден в списке (TrackListItem рендерит TrackRow с data-testid="track-row-<id>").
    // Заголовок трека — из имени файла ("mp3_15s_sample_file_236KB").
    await expect(page.getByTestId(/^track-row-/).first()).toBeVisible({ timeout: 10000 });

    // Название содержит "mp3_15s".
    await expect(page.getByText(/mp3_15s/).first()).toBeVisible();

    // Кнопка "Играть всё" появилась (была скрыта до загрузки — tracks.length === 0).
    await expect(page.getByTestId('logii-play-all')).toBeVisible();
  });

  test('удаление трека — пропадает из списка, тост «Трек удалён»', async ({ page }) => {
    // 1. Загружаем
    await page.getByTestId('logii-upload-input').setInputFiles(mp3Path);

    const trackRow = page.getByTestId(/^track-row-/).first();
    await expect(trackRow).toBeVisible({ timeout: 10000 });

    // 2. Удаляем (берём id из data-testid трека)
    const testId = await trackRow.getAttribute('data-testid');
    const trackId = testId!.replace('track-row-', '');

    page.once('dialog', (d) => d.accept());
    await page.getByTestId(`logii-delete-track-${trackId}`).click();

    // 3. Трек пропал из списка.
    await expect(page.getByTestId(/^track-row-/)).toHaveCount(0, { timeout: 5000 });

    // 4. Пустое состояние.
    await expect(page.getByText('Нет аудио в этой папке')).toBeVisible();

    // 5. Тост.
    await expect(page.getByRole('status').filter({ hasText: 'Трек удалён' })).toBeVisible();
  });

  test('удаление топа — топ пропадает из колонки, тост', async ({ page }) => {
    // 1. Загружаем трек (чтобы папка "1" перестала быть пустой и в UI было что удалять).
    await page.getByTestId('logii-upload-input').setInputFiles(mp3Path);
    await expect(page.getByTestId(/^track-row-/).first()).toBeVisible({ timeout: 10000 });

    // 2. Возвращаемся к автору, чтобы видеть колонку "Папки".
    await page.goBack(); // или клик по breadcrumb/«К папкам»
    // Но проще — идём по URL автора напрямую, чтобы не зависеть от истории.
    await page.goto(`/folder/yandex-self/logii.2024-11-08/userA`);

    // 3. Папка "1" видна в колонке.
    await expect(page.getByTestId('logii-folder-1')).toBeVisible({ timeout: 5000 });

    // 4. Удаляем топ "1".
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('folder-row-1').hover();
    await page.getByTestId('folder-delete-1').click();

    // 5. Папка "1" пропала из колонки.
    await expect(page.getByTestId('logii-folder-1')).toHaveCount(0, { timeout: 5000 });

    // 6. Тост.
    await expect(page.getByRole('status').filter({ hasText: 'Удалено' })).toBeVisible();
  });
});
