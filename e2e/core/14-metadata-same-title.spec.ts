// e2e/core/14-metadata-same-title.spec.ts

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
  'Album1/Artist A - Track 1.mp3': mp3Uint8,
  'Album2/Artist A - Track 1.mp3': mp3Uint8,
};

declare global {
  interface Window {
    __library?: any;
    __playlists?: any;
  }
}

/** Локатор на контейнер трека (div с uuid), исключая вложенный track-row-title. */
function trackRowLocator(page: import('@playwright/test').Page) {
  return page
    .locator('[data-testid^="track-row-"]')
    .filter({ has: page.locator('[data-testid="list-row-click-zone"]') });
}

test.describe('Core: Склейка метаданных (одинаковый artist/title, разные папки)', () => {
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
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.evaluate(async () => {
      const dbs = await (indexedDB as any).databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('player:uiSettings', JSON.stringify({ autoFetchMetadata: false }));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByTestId('plugin-connect').click();
  });

  test('два трека с одинаковым artist/title склеиваются в один Track с двумя sources', async ({ page }) => {
    const album1Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album1' });
    const album2Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album2' });

    await expect(album1Row).toBeVisible();
    await expect(album2Row).toBeVisible();

    await expect(album1Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });
    await expect(album2Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });

    // IDB: 1 трек, 2 sources
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const targetTracks = tracks.filter((t) => t.title === 'Track 1');
          if (targetTracks.length !== 1) return `expected 1 track, found ${targetTracks.length}`;
          return targetTracks[0].sources.length;
        },
        { timeout: 5000 },
      )
      .toBe(2);
  });

  test('оба folder.trackIds содержат один и тот же склеенный трек', async ({ page }) => {
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.folders) return null;
          const folderA = Object.values(lib.folders).find((f: any) => f.name === 'Album1') as any;
          const folderB = Object.values(lib.folders).find((f: any) => f.name === 'Album2') as any;
          if (!folderA || !folderB) return null;
          const shared = folderA.trackIds.filter((id: string) => folderB.trackIds.includes(id));
          return { folderA: folderA.trackIds.length, folderB: folderB.trackIds.length, shared: shared.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ folderA: 1, folderB: 1, shared: 1 });
  });

  test('внешние метаданные применяются к склеенному треку, оба sources сохраняются', async ({ page }) => {
    const album1Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album1' });
    await expect(album1Row).toBeVisible({ timeout: 10000 });
    await album1Row.click();

    const trackRow = trackRowLocator(page).first();
    await expect(trackRow).toBeVisible({ timeout: 10000 });

    // Ручной поиск метаданных
    await trackRow.getByTestId('track-actions-trigger').click();
    await page.getByTestId('track-action-find-metadata').click();

    const confirmButton = page.getByTestId('modal-confirm');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });

    // IDB: единственный трек переименован, но сохранил 2 sources
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const mocked = tracks.filter((t) => t.title === 'Mocked Title');
          if (mocked.length !== 1) return { count: mocked.length, sources: null };
          return { count: 1, sources: mocked[0].sources.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ count: 1, sources: 2 });
  });
});
