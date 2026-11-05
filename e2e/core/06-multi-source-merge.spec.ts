// e2e/core/06-multi-source-merge.spec.ts

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockFileSystem } from '../helpers/fs-mock';
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

test.describe('Core: Склейка треков из разных папок', () => {
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
      localStorage.setItem('player:uiSettings', JSON.stringify({ autoFetchMetadata: false }));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();
  });

  test('один трек из двух разных папок склеивается в один Track с двумя sources', async ({ page }) => {
    const album1Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album1' });
    const album2Row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album2' });

    await expect(album1Row).toBeVisible();
    await expect(album2Row).toBeVisible();
    await expect(album1Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });
    await expect(album2Row.getByText('1 трек')).toBeVisible({ timeout: 10000 });

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

  test('трек из yandex + трек из yandex-self → один Track с двумя sources (merged-soft → candidate)', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
    );
    await page.route('**/api/yandex-self/auth/check', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await page.route('**/api/health', (r) => r.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));

    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') ?? '/';
      const clean = path
        .replace(/^disk:\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (clean === '') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder A', path: 'disk:/Folder A' }] }),
        });
      }
      if (clean === 'Folder A') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                type: 'file',
                name: 'Artist A - Track 1.mp3',
                path: 'disk:/Folder A/Artist A - Track 1.mp3',
                isAudio: true,
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 404, body: 'Not found' });
    });

    await page.route('**/api/yandex-self/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') ?? '/';
      const clean = path
        .replace(/^disk:\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (clean === '') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder B', path: 'Folder B' }] }),
        });
      }
      if (clean === 'Folder B') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                type: 'file',
                name: 'Artist A - Track 1.mp3',
                path: 'Folder B/Artist A - Track 1.mp3',
                isAudio: true,
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 404, body: 'Not found' });
    });

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
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('plugin-activated:yandex-self', 'true');
      // ВАЖНО: не сканировать yandex-self при старте (useAppBootstrap).
      // Подключим вручную в тесте.
      localStorage.setItem('yandex-self-disconnected', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // 1. yandex → Folder A → Track 1
    const yandexCard = page.locator('[data-plugin-id="yandex"]');
    await yandexCard.getByRole('button', { name: 'Подключить' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex/);

    const folderA = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder A' });
    await expect(folderA).toBeVisible();
    await folderA.click();

    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.tracks) return 0;
          return Object.values(lib.tracks).filter((t: any) => t.title === 'Track 1').length;
        },
        { timeout: 5000 },
      )
      .toBe(1);

    // 2. yandex-self → Folder B → Track 1
    await page.goto('/');
    await waitForAppBootstrap(page);

    const selfCard = page.locator('[data-plugin-id="yandex-self"]');
    await expect(selfCard).toBeVisible();
    const selfOpen = selfCard.getByRole('button', { name: 'Открыть' });
    if (await selfOpen.isVisible()) {
      await selfOpen.click();
    } else {
      await selfCard.getByRole('button', { name: 'Подключить' }).click();
    }
    await expect(page).toHaveURL(/\/folder\/yandex-self/);

    const folderB = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder B' });
    await expect(folderB).toBeVisible();
    await folderB.click();

    // 3. После merge-soft: либо 1 Track с 2 sources (strict), либо 2 Track (candidate).
    //    Для одинаковых title (Track 1) — strict (1 Track, 2 sources).
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.tracks) return null;

          const tracks = Object.values(lib.tracks).filter((t: any) => t.title === 'Track 1');
          if (tracks.length !== 1) return { count: tracks.length, sources: null };

          const track = tracks[0] as any;
          return { count: 1, sources: track.sources.map((s: any) => s.pluginId).sort() };
        },
        { timeout: 10000 },
      )
      .toEqual({ count: 1, sources: ['yandex', 'yandex-self'] });

    // 4. Оба folder.trackIds содержат его
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.folders) return null;

          const folderARec = Object.values(lib.folders).find((f: any) => f.name === 'Folder A') as any;
          const folderBRec = Object.values(lib.folders).find((f: any) => f.name === 'Folder B') as any;
          if (!folderARec || !folderBRec) return null;

          return { folderA: folderARec.trackIds.length, folderB: folderBRec.trackIds.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ folderA: 1, folderB: 1 });
  });

  test('разные title ([extended suffix]) → merged-soft → 2 tracks с candidate; резолв через UI', async ({ page }) => {
    await page.route('**/api/auth/me', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
    );
    await page.route('**/api/yandex-self/auth/check', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );
    await page.route('**/api/health', (r) => r.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));

    // Yandex.Disk: Folder A → Track 1 [extended suffix].mp3
    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') ?? '/';
      const clean = path
        .replace(/^disk:\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (clean === '') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder A', path: 'disk:/Folder A' }] }),
        });
      }
      if (clean === 'Folder A') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                type: 'file',
                name: 'Artist A - Track 1 [extended suffix].mp3',
                path: 'disk:/Folder A/Artist A - Track 1 [extended suffix].mp3',
                isAudio: true,
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 404, body: 'Not found' });
    });

    // Yandex.Self: Folder B → Track 1.mp3 (без суффикса)
    await page.route('**/api/yandex-self/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.searchParams.get('path') ?? '/';
      const clean = path
        .replace(/^disk:\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (clean === '') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [{ type: 'dir', name: 'Folder B', path: 'Folder B' }] }),
        });
      }
      if (clean === 'Folder B') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                type: 'file',
                name: 'Artist A - Track 1.mp3',
                path: 'Folder B/Artist A - Track 1.mp3',
                isAudio: true,
              },
            ],
          }),
        });
      }
      return route.fulfill({ status: 404, body: 'Not found' });
    });

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
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('plugin-activated:yandex-self', 'true');
      localStorage.setItem('yandex-self-disconnected', 'true'); // не сканировать при старте
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // 1. yandex → Folder A → Track 1 [extended suffix]
    const yandexCard = page.locator('[data-plugin-id="yandex"]');
    await yandexCard.getByRole('button', { name: 'Подключить' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex/);

    const folderA = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder A' });
    await expect(folderA).toBeVisible();
    await folderA.click();

    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.tracks) return 0;
          return Object.values(lib.tracks).filter((t: any) => t.title.includes('Track 1')).length;
        },
        { timeout: 5000 },
      )
      .toBe(1);

    // 2. yandex-self → Folder B → Track 1 (merged-soft → 2 track, 1 candidate)
    await page.goto('/');
    await waitForAppBootstrap(page);

    const selfCard = page.locator('[data-plugin-id="yandex-self"]');
    await expect(selfCard).toBeVisible();
    const selfOpen = selfCard.getByRole('button', { name: 'Открыть' });
    if (await selfOpen.isVisible()) {
      await selfOpen.click();
    } else {
      await selfCard.getByRole('button', { name: 'Подключить' }).click();
    }
    await expect(page).toHaveURL(/\/folder\/yandex-self/);

    const folderB = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder B' });
    await expect(folderB).toBeVisible();
    await folderB.click();

    // 3. Проверяем, что есть 2 трека (yandex + yandex-self), и у yandex есть candidate.
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib?.tracks) return null;
          const tracks = Object.values(lib.tracks).filter((t: any) => t.title.includes('Track 1'));
          const withCandidates = tracks.filter((t: any) => t.metadataCandidates?.length > 0);
          return { total: tracks.length, withCandidates: withCandidates.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ total: 2, withCandidates: 1 });

    // 4. Открываем «Проблемные совпадения».
    await expect(page.locator('[aria-label="Проблемные совпадения"]')).toBeVisible({ timeout: 10000 });
    await page.locator('[aria-label="Проблемные совпадения"]').click();

    // 5. Кликаем «Это он».
    await page.getByText('Это он').first().click();

    // 6. Один трек, 2 sources.
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          const tracks = Object.values(lib.tracks) as any[];
          const track1 = tracks.filter((t) => t.title.includes('Track 1'));
          if (track1.length !== 1) return { count: track1.length };
          return { count: 1, sources: track1[0].sources.map((s) => s.pluginId).sort() };
        },
        { timeout: 10000 },
      )
      .toEqual({ count: 1, sources: ['yandex', 'yandex-self'] });

    // 7. Оба folder.trackIds содержат его.
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          const folders = Object.values(lib.folders) as any[];
          const folderA = folders.find((f) => f.name === 'Folder A');
          const folderB = folders.find((f) => f.name === 'Folder B');
          return { folderA: folderA?.trackIds.length, folderB: folderB?.trackIds.length };
        },
        { timeout: 10000 },
      )
      .toEqual({ folderA: 1, folderB: 1 });
  });
});
