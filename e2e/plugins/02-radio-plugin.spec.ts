// e2e/03-radio-plugin.spec.ts

import { test, expect } from '@playwright/test';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

test.describe('Radio Plugin', () => {
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
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
  });

  test('добавление станции из каталога и её воспроизведение', async ({ page }) => {
    const radioCard = page.locator('[data-plugin-id="radio"]');
    await radioCard.getByRole('button', { name: 'Открыть' }).click();

    await expect(page.getByText('Мои станции').first()).toBeVisible();
    await page.getByRole('button', { name: 'Добавить станции' }).click();

    // Ждем, пока пройдет сетевой запрос к радио-браузеру
    // Наш мок в mocks/api/radio.ts отвечает на '**/json/stations/search*'
    await page.waitForResponse((response) => response.url().includes('/json/stations/search'));

    // Ждем появления станции
    const stationRow = page.getByTestId('radio-station-row').first();
    await expect(stationRow).toBeVisible();

    // Добавляем станцию
    await stationRow.getByTestId('radio-station-add').locator('button').click();

    await page.getByRole('button', { name: 'К выбранным станциям' }).click();

    const savedStation = page.getByTestId('saved-station-row').first();
    await expect(savedStation).toBeVisible();

    await savedStation.click();

    // Проверяем, что плеер начал играть
    await expect(page.getByTestId('now-playing-title').first()).toHaveText('Test Radio Station');

    // Форсируем сохранение (через событие) и проверяем IDB
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

    await expect
      .poll(
        async () => {
          return await getIDBValue<any>(page, 'player:state');
        },
        { timeout: 5000 },
      )
      .not.toBeNull();

    const playerState = await getIDBValue<any>(page, 'player:state');
    expect(playerState.tracks).toHaveLength(1);
    expect(playerState.tracks[0].title).toBe('Test Radio Station');
  });
});
