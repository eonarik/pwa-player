// e2e/plugins/10-local-matches.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';
import { mockDownloadDir } from '../helpers/fs-mock';

/**
 * Сценарии локальных совпадений (скачанные файлы).
 *
 * Проверяем, что при сканировании облачной папки, если в папке скачивания
 * (downloadDir) есть файл с таким же относительным путем, к треку добавляется
 * local-source и в UI появляется метка "скачано".
 */

test.describe('G. Локальные совпадения', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);

    // Мокаем авторизацию
    await page.route('**/api/auth/me', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
    );

    // Мокаем API Яндекс.Диска
    await page.route('**/api/disk/resources**', async (route) => {
      const url = new URL(route.request().url());
      const path =
        url.searchParams
          .get('path')
          ?.replace(/^disk:\//, '')
          .replace(/^\/+/, '') || '';

      // Корень
      if (path === '') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ type: 'dir', name: 'Folder1', path: 'disk:/Folder1' }],
          }),
        });
      }

      // Folder1
      if (path === 'Folder1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              { type: 'file', name: 'track1.mp3', path: 'disk:/Folder1/track1.mp3', isAudio: true },
              { type: 'file', name: 'track2.mp3', path: 'disk:/Folder1/track2.mp3', isAudio: true },
            ],
          }),
        });
      }

      return route.fulfill({ status: 404, body: 'Not found' });
    });

    await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await page.route('**/fonts.gstatic.com/**', (r) => r.abort());

    // OPFS мок для downloadDir
    await mockDownloadDir(page, {
      // Файл track1.mp3 есть локально, track2.mp3 нет
      'cuei-yandex/Folder1/track1.mp3': 'dummy-local-audio-1',
      // Лишний файл, которого нет в облаке
      'cuei-yandex/Folder1/unknown.mp3': 'dummy-local-audio-unknown',
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
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
  });

  test('G1-G3: добавление local-source для совпавших файлов', async ({ page }) => {
    // 1. Выбираем папку скачивания
    await page.evaluate(async () => {
      await (window as any).__space.pickSpace();
    });
    await expect.poll(async () => page.evaluate(() => (window as any).__space.hasSpace.value)).toBe(true);

    // 2. Подключаем Яндекс.Диск
    const card = page.locator('[data-plugin-id="yandex"]');
    await card.getByRole('button', { name: 'Подключить' }).click();
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // 3. Ждём, пока Folder1 отсканируется и в ней появятся 2 трека
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<{ folders: Record<string, { urlPath: string; trackIds: string[] }> }>(
            page,
            'player:library',
          );
          if (!lib?.folders) return 0;
          const f1 = Object.values(lib.folders).find((f) => f.urlPath === 'Folder1');
          return f1?.trackIds?.length ?? 0;
        },
        { timeout: 10000 },
      )
      .toBeGreaterThanOrEqual(2);

    // 4. Заходим в Folder1
    const folderRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Folder1' });
    await expect(folderRow).toBeVisible();
    await folderRow.click();

    // 5. Проверяем треки
    const track1Row = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'track1' }).first();
    const track2Row = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'track2' }).first();

    await expect(track1Row).toBeVisible();
    await expect(track2Row).toBeVisible();

    // 6. Проверяем sources
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<{ tracks: Record<string, any> }>(page, 'player:library');
          if (!lib || !lib.tracks) return null;
          const t1 = Object.values(lib.tracks).find((t: any) => t.title === 'track1');
          if (!t1) return null;
          return t1.sources.some((s: any) => s.kind === 'local');
        },
        { timeout: 10000 },
      )
      .toBe(true);

    const lib = await getIDBValue<{ tracks: Record<string, any> }>(page, 'player:library');
    const t2 = Object.values(lib!.tracks).find((t: any) => t.title === 'track2');
    expect(t2.sources.some((s: any) => s.kind === 'local')).toBe(false);

    // 7. Проверяем UI-метку
    await expect(track1Row).toHaveClass(/list-row_downloaded/);
    await expect(track2Row).not.toHaveClass(/list-row_downloaded/);

    // 8. unknown.mp3 не должен появиться
    const unknownTrack = page.locator('[data-testid^="track-row-"]').filter({ hasText: 'unknown' });
    await expect(unknownTrack).toHaveCount(0);
  });
});
