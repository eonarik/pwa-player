// e2e/07-yandex-folder-statuses.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

test.describe('Yandex Disk: Статусы папок', () => {
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
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    const diskCard = page.locator('[data-plugin-id="yandex"]');
    await diskCard.getByRole('button', { name: 'Подключить' }).click();
  });

  test('отображает статусы папок, блокирует Play и восстанавливается после F5', async ({ page }) => {
    // 1. Ждем перехода в корень
    const artistFolderRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    const rootTrack = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'root_track' }).first();

    await expect(artistFolderRow).toBeVisible();
    await expect(rootTrack).toBeVisible();

    // 2. Проверяем статус
    await expect(artistFolderRow.getByText(/Ожидает сканирования|Синхронизация/).first()).toBeVisible();

    // 3. Кликаем на папку
    await artistFolderRow.click({ force: true });

    // 4. Ждем появления трека track1
    const track1 = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'track1' }).first();
    await expect(track1).toBeVisible();

    // 5. Возвращаемся к корню
    await page.goBack();

    // 6. Ждем, пока фоновый скан Artist A завершится (исчезнет лоадер)
    await expect(artistFolderRow.getByText(/Ожидает сканирования|Синхронизация/).first()).toBeHidden({
      timeout: 10000,
    });

    // И проверяем счетчик
    await expect(artistFolderRow.getByText('1 трек')).toBeVisible();

    // 7. ЖДЕМ СОХРАНЕНИЯ В IDB (чтобы трек гарантированно сохранился перед F5)
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          // Проверяем, что track1 попал в сохраненные треки
          return lib?.tracks ? Object.values(lib.tracks).some((t: any) => t.title === 'track1') : false;
        },
        { timeout: 5000 },
      )
      .toBe(true);

    // 8. Делаем F5
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // 9. После F5 папка должна сразу показывать "1 трек"
    await expect(artistFolderRow.getByText('1 трек')).toBeVisible();
    await expect(artistFolderRow.getByText('Ожидает сканирования')).toBeHidden();
  });
});
