// e2e/plugins/15-logii-view.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

/**
 * Тест проверяет:
 * 1. Папка с префиксом `logii.` в списке показывается без префикса.
 * 2. Клик на неё открывает `LogiiSeasonView` (а не FolderView).
 * 3. Клик на трек → `LogiiTrackView` (3 колонки: список автора, табы).
 * 4. Таб Chat: отправка комментария.
 *
 * Мок Яндекс.Диска:
 *   /logii.2024-11-08/
 *     userA/
 *       1/  → track1.mp3, cover.jpg, vibe.logii.txt
 *     userB/
 *       1/  → track2.mp3, vibe.logii.txt
 */

interface DiskItem {
  type: 'dir' | 'file';
  name: string;
  path: string;
  isAudio?: boolean;
}

const DISK_TREE: Record<string, DiskItem[]> = {
  '': [
    { type: 'dir', name: 'logii.2024-11-08', path: 'disk:/logii.2024-11-08' },
    { type: 'dir', name: 'Обычная папка', path: 'disk:/Обычная папка' },
  ],
  'logii.2024-11-08': [
    { type: 'dir', name: 'userA', path: 'disk:/logii.2024-11-08/userA' },
    { type: 'dir', name: 'userB', path: 'disk:/logii.2024-11-08/userB' },
  ],
  'logii.2024-11-08/userA': [{ type: 'dir', name: '1', path: 'disk:/logii.2024-11-08/userA/1' }],
  'logii.2024-11-08/userA/1': [
    { type: 'file', name: 'track1.mp3', path: 'disk:/logii.2024-11-08/userA/1/track1.mp3', isAudio: true },
    { type: 'file', name: 'cover.jpg', path: 'disk:/logii.2024-11-08/userA/1/cover.jpg' },
    { type: 'file', name: 'vibe.logii.txt', path: 'disk:/logii.2024-11-08/userA/1/vibe.logii.txt' },
  ],
  'logii.2024-11-08/userB': [{ type: 'dir', name: '1', path: 'disk:/logii.2024-11-08/userB/1' }],
  'logii.2024-11-08/userB/1': [
    { type: 'file', name: 'track2.mp3', path: 'disk:/logii.2024-11-08/userB/1/track2.mp3', isAudio: true },
  ],
  'Обычная папка': [],
};

const VIBE_CONTENT = `Вайб трека

===

userA (2024-11-08 20:15):
Первый комментарий`;

test.describe('Logii: read-only (сезон и трек)', () => {
  test.beforeEach(async ({ page }) => {
    setupPageLogs(page);
    await mockAllApis(page);
    await page.route('**/fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/fonts.gstatic.com/**', (route) => route.abort());

    await page.route('**/api/auth/me', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
    );
    await page.route('**/api/yandex-self/auth/check', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );

    await page.route('**/api/yandex-self/resources**', async (route) => {
      const url = new URL(route.request().url());
      const rawPath = url.searchParams.get('path') ?? '/';
      const clean = rawPath
        .replace(/^disk:\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
      const items = DISK_TREE[clean] ?? [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          path: clean,
          items: items.map((i) => ({
            type: i.type,
            name: i.name,
            path: i.path,
            isAudio: i.isAudio ?? false,
          })),
        }),
      });
    });

    await page.route('**/api/yandex-self/text**', async (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: VIBE_CONTENT, modified: '2024-11-08T20:15:00Z', size: VIBE_CONTENT.length }),
        });
      }

      // PUT — мок (принимаем и эхо)
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, modified: '2024-11-08T20:16:00Z' }),
      });
    });

    await page.route('**/api/yandex-self/download**', (route) =>
      route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'dummy' }),
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
      localStorage.setItem('plugin-activated:yandex-self', 'true');
      localStorage.setItem('logii:nickname', 'tester');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // Подключаем yandex-self
    const selfCard = page.locator('[data-plugin-id="yandex-self"]');
    await expect(selfCard).toBeVisible();
    const selfOpen = selfCard.getByRole('button', { name: 'Открыть' });
    if (await selfOpen.isVisible()) {
      await selfOpen.click();
    } else {
      await selfCard.getByRole('button', { name: 'Подключить' }).click();
    }
    await expect(page).toHaveURL(/\/folder\/yandex-self/);
  });

  test('папка logii. в списке без префикса; клик → LogiiSeasonView', async ({ page }) => {
    // В корне видна папка без префикса
    const seasonRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: '2024-11-08' });
    await expect(seasonRow).toBeVisible();
    // Префикс `logii.` в тексте не показывается
    await expect(seasonRow).not.toContainText('logii.');

    // Обычная папка остаётся как есть
    const usualFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Обычная папка' });
    await expect(usualFolder).toBeVisible();

    // Кликаем на сезон
    await seasonRow.click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08$/);

    // LogiiSeasonView показывает авторов (userA, userB) и треки
    await expect(page.getByText('userA', { exact: true })).toBeVisible();
    await expect(page.getByText('userB', { exact: true })).toBeVisible();
    await expect(page.getByText('Есть vibe + чат').first()).toBeVisible();
  });

  test('клик по треку → LogiiTrackView (табы, чат)', async ({ page }) => {
    const seasonRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: '2024-11-08' });
    await seasonRow.click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08$/);

    // Кликаем по треку userA
    const trackRow = page.getByText('track1', { exact: false }).first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08\/userA\/1$/);

    // Три таба
    await expect(page.getByRole('button', { name: 'Трек', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Чат', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Галерея', exact: true })).toBeVisible();

    // Vibe виден на табе «Трек»
    await expect(page.getByText('Вайб трека')).toBeVisible();

    // Переключаемся на «Чат»
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await expect(page.getByText('Первый комментарий')).toBeVisible();

    // Отправляем новый
    const textarea = page.locator('textarea[placeholder*="Написать комментарий"]');
    await textarea.fill('Привет из теста');
    await page.getByRole('button', { name: 'Отправить' }).click();

    // Проверяем, что комментарий появился в DOM (оптимистично)
    await expect(page.getByText('Привет из теста')).toBeVisible();
  });
});
