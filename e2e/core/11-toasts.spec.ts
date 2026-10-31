// e2e/core/11-toasts.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';

const FIXTURES = {
  'Music/Artist A/Album 1/01 - Track 1.mp3': 'dummy-audio-data-1',
  'Music/Artist A/Album 1/02 - Track 2.mp3': 'dummy-audio-data-2',
  'Music/Artist A/Album 1/03 - Track 3.mp3': 'dummy-audio-data-3',
};

test.describe('Core: Суммаризация тостов', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Мокаем play(), чтобы он ВСЕГДА бросал ошибку.
    // Это заставит плеер падать на каждом треке и вызывать тост.
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        return Promise.reject(new DOMException('Fake media error', 'NotSupportedError'));
      };
    });

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
    await initOPFS(page);
  });

  test('одинаковые ошибки суммируются в один тост со счетчиком', async ({ page }) => {
    // 1. Подключаем локальную папку
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    // 2. Заходим в папку с треками
    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    // 3. Кликаем ОДИН раз по первому треку.
    //    Так как у него есть source (handle), shouldSkipAuto его пропустит.
    //    Начнется playAt(0) -> play() упадет -> тост -> skipToNextOnError -> playAt(1)...
    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    // 4. Ждем, пока плеер переберет все 3 трека и тост суммируется.
    await expect
      .poll(
        async () => {
          const toast = page.locator('[role="status"]').filter({ hasText: 'Не удалось воспроизвести трек' });
          if (!(await toast.isVisible())) return null;
          const text = await toast.textContent();
          // Проверяем и "×3", и "(3 раза)" на случай, если ToastHost не обновлен
          const match = text?.match(/[×x]\s*(\d+)|\((\d+)\s*раз/);
          return match ? Number(match[1] || match[2]) : 1;
        },
        { timeout: 10000, message: 'Ожидание суммаризации 3-х ошибок в один тост' },
      )
      .toBe(3);

    // 5. Убеждаемся, что на экране ровно один тост
    const toasts = page.locator('[role="status"]');
    await expect(toasts).toHaveCount(1);
  });
});
