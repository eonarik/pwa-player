// e2e/plugins/11-metadata-album-cover.spec.ts

import { test, expect } from '@playwright/test';
import { mockFileSystem, initOPFS } from '../helpers/fs-mock';
import { mockAllApis } from '../mocks/api';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';

const FIXTURES = {
  'Music/Би-2 - Компромисс.mp3': 'dummy-audio-data-1',
};

test.describe('Metadata: обновление обложки существующего альбома', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await mockFileSystem(page, FIXTURES);

    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    // Мокаем ответ Звука (метаданные)
    await page.route('**/api/zvuk/metadata*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artist: 'Би-2',
          title: 'Компромисс',
          album: 'Свиридов', // Название альбома
          coverUrl: 'https://example.com/zvuk-cover.jpg',
          source: 'zvuk',
          similarity: 1.0,
          confident: true,
          trackId: 'zvuk-track-123',
        }),
      });
    });

    // Мокаем картинку обложки
    await page.route('**/zvuk-cover.jpg', (route) =>
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('dummy') }),
    );

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
      // Включаем автопоиск и Звук
      localStorage.setItem('player:uiSettings', JSON.stringify({ autoFetchMetadata: true }));
      localStorage.setItem('zvuk:fetchMetadata', 'true');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await initOPFS(page);

    // Подключаем локальную папку
    const localCard = page.locator('[data-plugin-id="local"]');
    await localCard.getByRole('button', { name: 'Подключить' }).click();

    const musicRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' });
    await expect(musicRow).toBeVisible();
    await musicRow.click();
  });

  test('Обложка обновляется у существующего альбома, если там было пусто', async ({ page }) => {
    const trackRow = page.locator('[data-testid^="track-row-"]').first();
    await expect(trackRow).toBeVisible();

    // 1. Сначала создаём альбом "Свиридов" БЕЗ обложки (симулируем импорт плейлиста или ручное редактирование)
    await trackRow.locator('button[aria-label="Действия"]').click();
    await page.getByText('Редактировать вручную').click();

    // Вводим название альбома вручную, обложку не ставим
    const albumInput = page.locator('input[placeholder="Укажите альбом вручную или выберите из списка"]');
    await albumInput.fill('Свиридов');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    // Ждём, пока трек привяжется к новому альбому без обложки
    await expect
      .poll(async () => {
        const albums = await getIDBValue<Record<string, any>>(page, 'player:albums');
        if (!albums) return null;
        const album = (Object.values(albums) as any[]).find((a) => a.name === 'Свиридов');
        return album ? album.coverUrl : 'NOT_FOUND';
      })
      .toBeNull();

    // 2. Теперь запускаем автопоиск (кликаем по треку, чтобы сработал useAutoActions)
    // Убеждаемся, что трек в статусе "не обработан" (сбрасываем флаг, если нужно, или просто перезапускаем)
    // В реальности автопоиск запустится при старте, но мы сбросили кеш.
    // Звук вернет метаданные, и applyPatch должен обновить обложку альбома.

    // Чтобы гарантировать запуск, кликнем по треку
    await trackRow.click();

    // 3. Проверяем, что обложка обновилась в существующем альбоме
    await expect
      .poll(
        async () => {
          const albums = await getIDBValue<Record<string, any>>(page, 'player:albums');
          if (!albums) return null;
          const album = (Object.values(albums) as any[]).find((a) => a.name === 'Свиридов');
          return album ? album.coverUrl : null;
        },
        { timeout: 10000 },
      )
      .toBe('https://example.com/zvuk-cover.jpg');
  });
});
