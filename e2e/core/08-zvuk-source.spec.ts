// e2e/core/08-zvuk-source.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

const FIXTURES = {
  // Трек без ID3, имя "Artist A - Track 1.mp3" — должен склеиться с Zvuk
  'Music/Artist A/Album 1/Artist A - Track 1.mp3': 'dummy-audio-data-1',
  // Трек без ID3, имя "Other Song.mp3" — не должен склеиться
  'Music/Artist A/Album 1/Other Song.mp3': 'dummy-audio-data-2',
};

test.describe('Zvuk → streaming-source', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Мокаем Zvuk metadata: strict-match для "Track 1", not-found для "Other Song"
    await page.route('**/api/zvuk/metadata*', async (route) => {
      const url = new URL(route.request().url());
      const title = url.searchParams.get('title') || '';
      const artist = url.searchParams.get('artist') || '';

      if (title.toLowerCase().includes('track 1') && artist.toLowerCase() === 'artist a') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            artist: 'Artist A',
            title: 'Track 1',
            album: 'Album 1',
            coverUrl: 'https://example.com/zvuk-cover.jpg',
            source: 'zvuk',
            similarity: 1.0,
            confident: true,
            trackId: 'zvuk-track-123',
          }),
        });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
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
      localStorage.setItem('zvuk:fetchMetadata', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicFolder).toBeVisible();
    await musicFolder.click();

    const artistFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Artist A' });
    await artistFolder.click();

    const albumFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Album 1' });
    await albumFolder.click();
  });

  test('strict-match Zvuk → добавляет streaming-source в трек', async ({ page }) => {
    const track1Row = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Track 1' }).first();
    await expect(track1Row).toBeVisible();

    // Кликаем → автопоиск (useAutoActions) → Zvuk strict-match
    await track1Row.click();

    // Ждём, пока автопоиск завершится и sources обновится
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const track = Object.values(lib.tracks).find((t: any) => t.title === 'Track 1') as any;
          if (!track) return null;
          return {
            sourceKinds: track.sources.map((s: any) => `${s.kind}:${s.pluginId}`).sort(),
            hasZvukUrl: track.sources.some(
              (s: any) => s.kind === 'streaming' && s.pluginId === 'zvuk' && s.url?.includes('zvuk-track-123'),
            ),
          };
        },
        { timeout: 15000 },
      )
      .toEqual({
        sourceKinds: ['local:local', 'streaming:zvuk'],
        hasZvukUrl: true,
      });
  });

  test('not-found Zvuk → streaming-source НЕ добавляется', async ({ page }) => {
    const otherRow = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'Other Song' }).first();
    await expect(otherRow).toBeVisible();

    await otherRow.click();

    // Ждём, пока автопоиск попытается (или пропустит)
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<any>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const track = Object.values(lib.tracks).find((t: any) => t.title === 'Other Song') as any;
          if (!track) return null;
          return track.sources.some((s: any) => s.kind === 'streaming' && s.pluginId === 'zvuk');
        },
        { timeout: 5000 },
      )
      .toBe(false);
  });
});
