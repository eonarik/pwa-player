// e2e/plugins/20-logii-create-season.spec.ts

import { test, expect } from '@playwright/test';
import { mockLogii, bootstrapLogii, readLibraryFolders, type DiskItem } from '../helpers/logii-helpers';

const TREE: Record<string, DiskItem[]> = {
  '': [],
};

test.describe('Logii: создание сезона', () => {
  test('создаёт пустую папку и переходит внутрь', async ({ page }) => {
    const { diskTree, writes } = await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);

    // Кнопка «Сезон» в шапке папки
    await page.getByTestId('folder-action-create-season').click();

    // Модалка: поле имени + submit
    await page.getByTestId('create-folder-input').fill('2025-01-01');
    await page.getByTestId('create-folder-submit').click();

    // Переход в новый сезон
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2025-01-01$/);

    // Force-скан создал папку в library
    await expect
      .poll(async () => (await readLibraryFolders(page))?.some((f) => f.urlPath === 'logii.2025-01-01'), {
        timeout: 5000,
      })
      .toBe(true);

    // На Диске папка есть (мок обновлён)
    expect(diskTree[''].some((i) => i.name === 'logii.2025-01-01')).toBe(true);

    // Запрос на создание был
    expect(writes.some((w) => w.method === 'POST' && w.path === '/folder')).toBe(true);
  });

  test('не создаёт дубликат, если имя занято', async ({ page }) => {
    const tree: Record<string, DiskItem[]> = {
      '': [{ type: 'dir', name: 'logii.2025-01-01', path: 'disk:/logii.2025-01-01' }],
    };
    await mockLogii(page, { diskTree: tree });
    await bootstrapLogii(page);

    await page.getByTestId('folder-action-create-season').click();
    await page.getByTestId('create-folder-input').fill('2025-01-01');
    await page.getByTestId('create-folder-submit').click();

    await expect(page.getByText('Папка уже существует')).toBeVisible();
  });
});
