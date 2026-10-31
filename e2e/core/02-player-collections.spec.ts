// e2e/core/02-player-collections.spec.ts

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
  'Music/Artist A/Album 1/01 - Track 1.mp3': mp3Uint8,
  'Music/Artist A/Album 1/02 - Track 2.mp3': mp3Uint8,
};

test.describe('Player & Collections (ядро)', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
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
    await initOPFS(page);

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible();
    await musicRow.click();

    const artistARow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await expect(artistARow).toBeVisible();
    await artistARow.click();

    const albumRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await expect(albumRow).toBeVisible();
    await albumRow.click();
  });

  test('проигрывание трека, добавление в избранное, дизлайк и плейлист', async ({ page }) => {
    const track1Row = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Track 1' }).first();
    const track2Row = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Track 2' }).first();

    await expect(track1Row).toBeVisible();

    // 1. Кликаем по "Track 1"
    await track1Row.click();

    // 2. Проверяем, что плеер начал играть
    await expect(page.getByTestId('now-playing-title').first()).toHaveText('Track 1');

    // 3. ПРОВЕРКА ПОДСВЕТКИ РОДИТЕЛЬСКИХ ПАПОК
    await page.goto('/folder/local');

    const musicRowInRoot = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRowInRoot).toBeVisible();
    await expect(musicRowInRoot).toHaveClass(/list-row_active/);

    await musicRowInRoot.click();
    const artistARow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await expect(artistARow).toHaveClass(/list-row_active/);

    await artistARow.click();
    const albumRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await expect(albumRow).toHaveClass(/list-row_active/);

    await albumRow.click();

    // Убедимся, что трек все еще играет (на случай, если аудио сбилось при навигации)
    await expect(page.getByTestId('now-playing-title').first()).toHaveText('Track 1');

    // 4. Ставим дизлайк
    await track1Row.locator('button[aria-label="Скрывать при воспроизведении"]').click();

    // 5. Добавляем в Избранное
    await track2Row.locator('button[aria-label="В избранное"]').click();

    // 6. Создаем плейлист
    await track1Row.locator('button[aria-label="Действия"]').click();
    await page.getByText('Добавить в плейлист').click();
    await page.getByText('+ Создать новый').click();
    await page.getByPlaceholder('Название плейлиста').fill('My Test Playlist');
    await page.getByRole('button', { name: 'Создать' }).click();

    // 7. Проверяем сохранение в IDB
    await expect
      .poll(
        async () => {
          const historyState = await getIDBValue<any>(page, 'player:history');
          const dislikesState = await getIDBValue<any>(page, 'player:dislikes');
          const playlistsState = await getIDBValue<any>(page, 'player:playlists');

          return {
            history: historyState?.entries?.length || 0,
            dislikes: dislikesState?.entries?.length || 0,
            playlists: playlistsState?.playlists?.length || 0,
          };
        },
        {
          message: 'Ожидание сохранения коллекций в IDB',
          timeout: 10000,
        },
      )
      .toEqual({
        history: 1,
        dislikes: 1,
        playlists: 2,
      });
  });
});
