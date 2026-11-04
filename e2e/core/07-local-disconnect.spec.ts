// e2e/core/07-local-disconnect.spec.ts

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mp3Buffer = fs.readFileSync(path.resolve(__dirname, '../fixtures/mp3_15s_sample_file_236KB.mp3'));
const mp3Uint8 = new Uint8Array(mp3Buffer);

const FIXTURES = {
  'Music/Artist A/Album 1/Artist A - Track 1.mp3': mp3Uint8,
};

/** Очистить историю через Pinia store. */
async function clearHistory(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const historyStore = (window as any).__history();
    historyStore.clear();
  });
}

test.describe('Core: Отключение локального плагина', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        Object.defineProperty(this, 'paused', { value: false, configurable: true });
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () {
        Object.defineProperty(this, 'paused', { value: true, configurable: true });
        this.dispatchEvent(new Event('pause'));
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

  test('трек остается в плейлисте как недоступный, а очередь очищается при отключении', async ({ page }) => {
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    await expect
      .poll(async () => {
        const state = await getIDBValue<any>(page, 'player:state');
        return state?.tracks?.length || 0;
      })
      .toBeGreaterThan(0);

    // Добавляем в плейлист
    await trackRow.locator('button[aria-label="Действия"]').click();
    await page.getByText('Добавить в плейлист').click();
    await page.getByText('+ Создать новый').click();
    await page.getByPlaceholder('Название плейлиста').fill('Test Disconnect');
    await page.getByRole('button', { name: 'Создать' }).click();

    await expect
      .poll(async () => {
        const playlistsState = await getIDBValue<any>(page, 'player:playlists');
        return playlistsState?.playlists?.length || 0;
      })
      .toBe(2);

    // Отключаем local
    await page.goto('/');
    await localCard.getByRole('button', { name: 'Отключить' }).click();

    // Очередь очищена
    await expect
      .poll(async () => {
        const state = await getIDBValue<any>(page, 'player:state');
        return state?.tracks?.length || 0;
      })
      .toBe(0);

    // sources трека пуст
    await expect
      .poll(async () => {
        const lib = await getIDBValue<any>(page, 'player:library');
        if (!lib || !lib.tracks) return null;
        const tracks = Object.values(lib.tracks) as any[];
        return tracks.length > 0 ? tracks[0].sources.length : null;
      })
      .toBe(0);

    // Плейлист показывает недоступный трек
    await page.goto('/playlists');
    const playlistRow = page.locator('[data-testid^="playlist-row-"]').filter({ hasText: 'Test Disconnect' }).first();
    await expect(playlistRow).toBeVisible();
    await playlistRow.click();

    const unavailableTrack = page.locator('[data-testid^="track-row-"]').first();
    await expect(unavailableTrack).toBeVisible();
    await expect(unavailableTrack.getByText('Источник недоступен')).toBeVisible();
  });

  test('плеер останавливается при отключении текущего трека', async ({ page }) => {
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    // Убеждаемся, что играет
    await expect(page.getByTestId('player-info-container-desktop').getByTestId('now-playing-title')).toBeVisible({
      timeout: 5000,
    });

    // Отключаем local
    await page.goto('/');
    await localCard.getByRole('button', { name: 'Отключить' }).click();

    // A. Store: плеер остановлен (queue пуст, currentIndex = -1)
    await expect
      .poll(
        async () => {
          const state = await getIDBValue<any>(page, 'player:state');
          if (!state) return null;
          return {
            tracks: state.tracks?.length ?? 0,
            currentIndex: state.currentIndex,
          };
        },
        { timeout: 5000 },
      )
      .toEqual({ tracks: 0, currentIndex: -1 });

    // B. UI: десктопный плеер показывает «Ничего не играет»
    await expect(page.getByTestId('player-info-container-desktop').getByTestId('now-playing-title')).toHaveText(
      'Ничего не играет',
      { timeout: 5000 },
    );
  });

  test('мертвый трек удаляется, если он не в плейлистах', async ({ page }) => {
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    // Убеждаемся, что играет (явно проверяем десктопный контейнер,
    // чтобы не наткнуться на скрытый мобильный)
    await expect(page.getByTestId('player-info-container-desktop').getByTestId('now-playing-title')).toBeVisible({
      timeout: 5000,
    });

    // Возвращаемся на главную и отключаем локальный плагин
    await page.goto('/');
    await expect(localCard).toBeVisible();
    await localCard.getByRole('button', { name: 'Отключить' }).click();

    // Ждем, пока player:state обновится (очистится)
    await expect
      .poll(
        async () => {
          const state = await getIDBValue<any>(page, 'player:state');
          return state?.tracks?.length || 0;
        },
        { timeout: 10000 },
      )
      .toBe(0);

    // Очищаем историю, чтобы трек стал «сиротой» (иначе cleanupOrphanTracks
    // не удалит его, потому что он есть в истории).
    await clearHistory(page);

    // Делаем перезагрузку страницы, чтобы сработал cleanupOrphanTracks
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // Проверяем, что трек исчез из библиотеки (в IDB)
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return 0;
          return Object.keys(lib.tracks).length;
        },
        { timeout: 10000 },
      )
      .toBe(0);
  });
});
