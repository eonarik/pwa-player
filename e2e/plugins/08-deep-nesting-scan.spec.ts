// e2e/plugins/08-deep-nesting-scan.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

test.describe('Yandex Disk: Глубокая вложенность', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Мокаем API Диска с глубокой вложенностью (5 уровней)
    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') || '/';

      // Имитируем иерархию: / -> Folder 1 -> Folder 2 -> Folder 3 -> Folder 4
      if (path === '/' || path === 'disk:/') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder 1', path: 'disk:/Folder 1' }] }),
        });
      }

      if (path.includes('Folder 1') && !path.includes('Folder 2')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder 2', path: 'disk:/Folder 1/Folder 2' }] }),
        });
      }

      if (path.includes('Folder 2') && !path.includes('Folder 3')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ type: 'dir', name: 'Folder 3', path: 'disk:/Folder 1/Folder 2/Folder 3' }],
          }),
        });
      }

      if (path.includes('Folder 3')) {
        // На последнем уровне кидаем трек
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                type: 'file',
                name: 'deep_track.mp3',
                path: 'disk:/Folder 1/Folder 2/Folder 3/deep_track.mp3',
                isAudio: true,
              },
            ],
          }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    const diskCard = page.locator('[data-plugin-id="yandex"]');
    await diskCard.getByRole('button', { name: 'Подключить' }).click();
  });

  test('корректно сканирует глубокую вложенность без зависаний', async ({ page }) => {
    // Ждем, пока появится "Folder 1"
    const folder1 = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder 1' });
    await expect(folder1).toBeVisible();

    // Ждем, пока фоновое сканирование завершится (исчезнет лоадер)
    // В нашем UI при сканировании показывается статус "Синхронизация..."
    await expect(folder1.getByText('Синхронизация...')).toBeHidden({ timeout: 15000 });

    // Проверяем, что в IDB сохранился трек с глубокой вложенностью
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return 0;
          const tracks = Object.values(lib.tracks) as any[];
          return tracks.filter((t) => t.title === 'deep_track').length;
        },
        { timeout: 10000 },
      )
      .toBe(1);

    // Кликаем на Folder 1 и проверяем, что там виден Folder 2 (и нет зацикливания UI)
    await folder1.click();
    const folder2 = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder 2' });
    await expect(folder2).toBeVisible();
  });
});
