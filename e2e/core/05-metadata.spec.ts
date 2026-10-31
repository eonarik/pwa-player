// e2e/core/05-metadata.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const FIXTURES = {
  'Music/Artist A/Album 1/Artist A - Track 1.mp3': 'dummy-audio-data-1',
  'Music/30 Seconds to Mars/The Kill.mp3': 'dummy-audio-data-2',
};

test.describe('Core: Метаданные (Все сценарии)', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // МОКАЕМ HTMLMediaElement.play(), чтобы плеер не падал на невалидном файле
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
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
      localStorage.setItem('player:uiSettings', JSON.stringify({ autoFetchMetadata: true }));
      localStorage.setItem('zvuk:fetchMetadata', 'false');
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();
  });

  test('1. ручной поиск обновляет UI, плеер и IndexedDB', async ({ page }) => {
    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();
    await expect(page.getByTestId('now-playing-title').first()).toHaveText('Track 1');

    // Ручной поиск
    await trackRow.locator('button[aria-label="Действия"]').click();
    await page.getByText('Найти в интернете').first().click();

    const confirmButton = page.getByRole('button', { name: 'Продолжить' });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Проверяем UI и плеер
    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 10000,
    });
    await expect(page.getByTestId('now-playing-title').first()).toHaveText('Mocked Title');

    // Проверяем IDB
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const track = tracks.find((t) => t.title === 'Mocked Title');
          return track ? track.artist : null;
        },
        { timeout: 10000 },
      )
      .toBe('Artist A');
  });

  test('2. ручная очистка возвращает исходные значения и сбрасывает альбом', async ({ page }) => {
    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    // Ждем автопоиск
    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });

    // Очищаем
    await trackRow.locator('button[aria-label="Действия"]').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByText('Удалить метаданные').click();

    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Track 1', { timeout: 10000 });

    // Проверяем IDB
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const track = tracks.find((t) => t.title === 'Track 1');
          return track ? track.albumId : null;
        },
        { timeout: 10000 },
      )
      .toBeNull();
  });

  test('3. автопоиск подтягивает метаданные при первом запуске трека', async ({ page }) => {
    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });
  });

  test('4. автопоиск подтягивает обложку и сохраняет её в Album (IDB)', async ({ page }) => {
    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    // Ждем, пока автопоиск подтянет обложку
    await expect(trackRow.locator('[data-testid="track-cover-img"]')).toBeVisible({ timeout: 15000 });

    // Проверяем, что обложка сохранилась в Album (player:albums)
    await expect
      .poll(
        async () => {
          const albumsData = await getIDBValue<any>(page, 'player:albums');
          if (!albumsData) return null;
          const albums = Object.values(albumsData) as any[];
          const mockedAlbum = albums.find((a) => a.name === 'Mocked Album');
          return mockedAlbum ? mockedAlbum.coverUrl : null;
        },
        { timeout: 10000 },
      )
      .toBe('https://example.com/mocked-cover.jpg');
  });

  test('5. не перезаписывает artist, если нет строгого совпадения, но подтягивает альбом', async ({ page }) => {
    const marsFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: '30 Seconds to Mars' });
    await marsFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    // Ждем, пока UI покажет правильного артиста (не перезаписался)
    await expect(trackRow.getByText('30 Seconds to Mars')).toBeVisible({ timeout: 15000 });

    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const tracks = Object.values(lib.tracks) as any[];
          const track = tracks.find((t) => t.title.includes('The Kill'));
          return track ? track.artist : null;
        },
        { timeout: 10000 },
      )
      .toBe('30 Seconds to Mars');
  });

  test('6. автопоиск запускается заново после сброса метаданных', async ({ page }) => {
    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });

    // Сбрасываем
    await trackRow.locator('button[aria-label="Действия"]').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByText('Удалить метаданные').click();
    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Track 1', { timeout: 10000 });

    // Перезапускаем (кликаем снова)
    await trackRow.click();
    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });
  });

  test('7. если Звук падает с 500, поиск идет в iTunes', async ({ page }) => {
    // Включаем Звук и заставляем его падать
    await page.evaluate(() => localStorage.setItem('zvuk:fetchMetadata', 'true'));
    await page.route('**/api/zvuk/metadata*', (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }));

    // Перехватываем iTunes
    let itunesCalled = false;
    await page.route('**/api/track-metadata*', (route) => {
      itunesCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artist: 'Artist A',
          title: 'Mocked Title',
          album: 'Mocked Album',
          coverUrl: null,
          source: 'itunes',
          similarity: 1,
          confident: true,
        }),
      });
    });

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();
    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();

    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await trackRow.click();

    await expect(page.locator('[data-testid="track-row-title"]').first()).toHaveText('Mocked Title', {
      timeout: 15000,
    });
    expect(itunesCalled).toBe(true);
  });
});
