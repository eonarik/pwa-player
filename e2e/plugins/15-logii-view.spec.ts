// e2e/plugins/15-logii-view.spec.ts

import { test, expect } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

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

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

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

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, modified: '2024-11-08T20:16:00Z' }),
      });
    });

    await page.route('**/api/yandex-self/download**', (route) => {
      const url = new URL(route.request().url());
      const rawPath = url.searchParams.get('path') ?? '';
      const ext = rawPath.split('.').pop()?.toLowerCase() ?? '';

      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG });
      }

      return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'dummy' });
    });

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
      for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('plugin-activated:yandex-self', 'true');
      localStorage.setItem('logii:nickname', 'tester');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    const selfCard = page.locator('[data-plugin-id="yandex-self"]');
    await expect(selfCard).toBeVisible();
    const selfOpen = selfCard.getByTestId('plugin-open');
    if (await selfOpen.isVisible()) {
      await selfOpen.click();
    } else {
      await selfCard.getByTestId('plugin-connect').click();
    }
    await expect(page).toHaveURL(/\/folder\/yandex-self/);

    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const fn = (window as unknown as { __library?: () => unknown }).__library;
            if (!fn) return 0;
            const lib = fn() as { folders: Record<string, { pluginId: string; urlPath: string }> };
            return Object.values(lib.folders).filter((f) => f.pluginId === 'yandex-self' && f.urlPath === '').length;
          });
        },
        { timeout: 10000 },
      )
      .toBe(1);
  });

  test('папка logii. в списке без префикса; клик → LogiiView', async ({ page }) => {
    const seasonRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: '2024-11-08' });
    await expect(seasonRow).toBeVisible();
    await expect(seasonRow).not.toContainText('logii.');

    const usualFolder = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Обычная папка' });
    await expect(usualFolder).toBeVisible();

    await seasonRow.click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08$/);

    await expect(page.getByText('userA', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('userB', { exact: true }).first()).toBeVisible();

    await expect
      .poll(async () => page.url(), { timeout: 5000 })
      .toContain('/folder/yandex-self/logii.2024-11-08/userA');

    await expect
      .poll(async () => page.url(), { timeout: 5000 })
      .toContain('/folder/yandex-self/logii.2024-11-08/userA/1');

    await expect(page.getByTestId('logii-go-to-parent')).toBeVisible();

    await expect(page.getByTestId('logii-tab-track')).toBeVisible();
    await expect(page.getByTestId('logii-tab-gallery')).toBeVisible();
  });

  test('клик по треку → LogiiView (табы, объединённый трек+чат)', async ({ page }) => {
    const seasonRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: '2024-11-08' });
    await seasonRow.click();
    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08$/);

    await expect
      .poll(async () => page.url(), { timeout: 5000 })
      .toContain('/folder/yandex-self/logii.2024-11-08/userA');

    const trackRow = page.getByText('track1', { exact: false }).first();
    await expect(trackRow).toBeVisible();
    await trackRow.click();

    await expect(page).toHaveURL(/\/folder\/yandex-self\/logii\.2024-11-08\/userA\/1$/);

    await expect(page.getByTestId('logii-tab-track')).toBeVisible();
    await expect(page.getByTestId('logii-tab-gallery')).toBeVisible();

    await expect(page.getByText('Вайб трека')).toBeVisible();

    // Чат на том же экране, без переключения табов
    await expect(page.getByText('Первый комментарий')).toBeVisible();

    await page.getByTestId('logii-comment-new-input').fill('Привет из теста');
    await page.getByTestId('logii-comment-send').click();

    await expect(page.getByText('Привет из теста')).toBeVisible();
  });
});
