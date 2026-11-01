// e2e/plugins/12-local-only-mode.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';
import { mockDownloadDir } from '../helpers/fs-mock';

test.describe('Plugin Yandex: Локальный режим', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);

    // Мокаем успешную авторизацию для yandex
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ authenticated: true }) }),
    );

    // Мокаем API Яндекс.Диска для успешного подключения
    await page.route('**/api/disk/resources**', (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') || '/';

      if (path === '/' || path === 'disk:/') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Music', path: 'disk:/Music' }] }),
        });
      }
      if (path.includes('Music') && !path.includes('Album')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Album 1', path: 'disk:/Music/Album 1' }] }),
        });
      }
      if (path.includes('Album 1')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ type: 'file', name: 'track.mp3', path: 'disk:/Music/Album 1/track.mp3', isAudio: true }],
          }),
        });
      }
      return route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) });
    });

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Создаём папку загрузок (в OPFS) с файлами для yandex
    await mockDownloadDir(page, {
      'cuei-yandex/Music/Album 1/track.mp3': 'dummy-local-audio-data',
    });

    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // 1. Подключаем папку загрузок
    await page.evaluate(async () => {
      await (window as any).__space.pickSpace();
    });
    await expect.poll(async () => page.evaluate(() => (window as any).__space.hasSpace.value)).toBe(true);

    // 2. Подключаем yandex
    const card = page.locator('[data-plugin-id="yandex"]');
    await card.getByRole('button', { name: 'Подключить' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // 3. Отключаем yandex
    await page.goto('/');
    await card.getByRole('button', { name: 'Отключить' }).click();

    // Ждём, пока кнопка "Подключить" снова появится
    await expect(card.getByRole('button', { name: 'Подключить' })).toBeVisible();
  });

  test('появляется кнопка "Открыть локально" и работает навигация', async ({ page }) => {
    const card = page.locator('[data-plugin-id="yandex"]');

    // Ждём, пока кнопка "Открыть локально" появится (так как yandex отключен, но hasLocalFiles = true)
    const openLocalBtn = card.getByRole('button', { name: 'Открыть локально' });
    await expect(openLocalBtn).toBeVisible({ timeout: 10000 });

    // Кликаем
    await openLocalBtn.click();

    // Должен произойти переход в папку
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // Проверяем, что папка Music видна (она восстановилась из файлов)
    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible({ timeout: 10000 });

    // Заходим в Music
    await musicRow.click();

    // Проверяем Album 1
    const albumRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await expect(albumRow).toBeVisible();
    await albumRow.click();

    // Проверяем трек track.mp3
    const trackRow = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'track' }).first();
    await expect(trackRow).toBeVisible();

    // Проверяем, что у трека есть local-source в IDB
    await expect
      .poll(async () => {
        const lib = await getIDBValue<any>(page, 'player:library');
        if (!lib || !lib.tracks) return false;
        const tracks = Object.values(lib.tracks) as any[];
        const t = tracks.find((tr) => tr.title.includes('track'));
        return t ? t.sources.some((s: any) => s.kind === 'local') : false;
      })
      .toBe(true);
  });
});
