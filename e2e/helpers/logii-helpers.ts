// e2e/plugins/logii-helpers.ts

import { expect, type Page, type Route } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from './test-utils';
import { mockAllApis } from '../mocks/api';

export interface DiskItem {
  type: 'dir' | 'file';
  name: string;
  path: string;
  isAudio?: boolean;
}

export const VIBE_CONTENT = `Вайб трека

===

userA (2024-11-08 20:15):
Первый комментарий`;

export const INTRO_CONTENT = `Добро пожаловать в мой уголок

===

userA (2024-11-08 20:10):
Привет!`;

export interface LogiiMockOptions {
  diskTree: Record<string, DiskItem[]>;
  introContent?: string;
  trackContent?: string;
}

/**
 * Моки для yandex-self.
 *
 * ВАЖНО: сначала вызывается mockAllApis (широкий ** / api / yandex - self; /** → 401),
 * потом специфичные маршруты. Playwright берёт последний подходящий,
 * поэтому специфичные перекрывают широкий. Если поменять порядок — resources
 * уйдёт в 401, и library.folders останется пустым.
 */
export async function mockLogii(page: Page, options: LogiiMockOptions): Promise<void> {
  const introContent = options.introContent ?? INTRO_CONTENT;
  const trackContent = options.trackContent ?? VIBE_CONTENT;

  await mockAllApis(page);

  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
  );
  await page.route('**/api/yandex-self/auth/check', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );

  await page.route('**/api/yandex-self/resources**', async (route: Route) => {
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '/';
    const clean = rawPath
      .replace(/^disk:\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const items = options.diskTree[clean] ?? [];
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

  await page.route('**/api/yandex-self/text**', async (route: Route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const url = new URL(route.request().url());
      const rawPath = url.searchParams.get('path') ?? '';
      const clean = rawPath.replace(/^disk:\//, '').replace(/^\/+/, '');
      const isIntro = !/\/[^/]+\/[^/]+\/[^/]+\.txt$/.test(clean);
      const content = isIntro ? introContent : trackContent;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content, modified: '2024-11-08T20:15:00Z', size: content.length }),
      });
    }
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
      Object.defineProperty(this, 'paused', { value: false, configurable: true });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      Object.defineProperty(this, 'paused', { value: true, configurable: true });
      this.dispatchEvent(new Event('pause'));
    };
  });
}

/**
 * Bootstrap: чистит IDB/localStorage, активирует yandex-self, подключает плагин,
 * открывает корень. НЕ мокает API — вызывающий должен сначала вызвать mockLogii.
 */
export async function bootstrapLogii(page: Page): Promise<void> {
  setupPageLogs(page);
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());

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
  const selfOpen = selfCard.getByRole('button', { name: 'Открыть' });
  if (await selfOpen.isVisible()) {
    await selfOpen.click();
  } else {
    await selfCard.getByRole('button', { name: 'Подключить' }).click();
  }
  await expect(page).toHaveURL(/\/folder\/yandex-self/);

  // Ждём корень yandex-self в library.folders
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
      { timeout: 15000 },
    )
    .toBe(1);
}

// --- остальные хелперы без изменений ---

export async function openLogiiSeason(page: Page, seasonName: string): Promise<void> {
  const row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: seasonName }).first();
  await expect(row).toBeVisible();
  await row.click();
}

export async function openAuthor(page: Page, authorName: string): Promise<void> {
  await page.getByText(authorName, { exact: true }).first().click();
}

export async function openFolder(page: Page, folderName: string): Promise<void> {
  await page.getByText(folderName, { exact: true }).first().click();
}

export async function clickTab(page: Page, tab: 'Трек' | 'Чат' | 'Галерея'): Promise<void> {
  await page.getByRole('button', { name: tab, exact: true }).click();
}

export async function readPlayerQueue(page: Page): Promise<Array<{ id: string; title: string }> | null> {
  return page.evaluate(() => {
    const fn = (window as unknown as { __player?: () => unknown }).__player;
    if (!fn) return null;
    const store = fn() as { queue: Array<{ id: string; title: string }> };
    return store.queue.map((t) => ({ id: t.id, title: t.title }));
  });
}

export async function readIsPlaying(page: Page): Promise<boolean | null> {
  return page.evaluate(() => {
    const fn = (window as unknown as { __player?: () => unknown }).__player;
    if (!fn) return null;
    const store = fn() as { isPlaying: boolean };
    return store.isPlaying;
  });
}
