// e2e/helpers/logii-helpers.ts

import { expect, type Page, type Route } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap } from '../helpers/test-utils';
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

export interface LogiiMockResult {
  /** Мутируемый diskTree — после write-операций обновляется. */
  diskTree: Record<string, DiskItem[]>;
  /** Все запросы на write-эндпоинты (для проверки). */
  writes: Array<{ method: string; path: string; body?: unknown }>;
}

/**
 * Моки для yandex-self. Stateful: write-операции (POST/DELETE/move/upload)
 * мутируют diskTree, GET /resources возвращает актуальное состояние.
 *
 * ВАЖНО: сначала mockAllApis (ставит широкий ** / api / yandex - self; /** → 401),
 * потом специфичные. Playwright берёт последний маршрут.
 */
export async function mockLogii(page: Page, options: LogiiMockOptions): Promise<LogiiMockResult> {
  const introContent = options.introContent ?? INTRO_CONTENT;
  const trackContent = options.trackContent ?? VIBE_CONTENT;
  const diskTree = options.diskTree;
  const writes: LogiiMockResult['writes'] = [];

  await mockAllApis(page);

  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
  );
  await page.route('**/api/yandex-self/auth/check', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );

  // --- GET resources ---
  await page.route('**/api/yandex-self/resources**', async (route: Route) => {
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '/';
    const clean = rawPath
      .replace(/^disk:\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const items = diskTree[clean] ?? [];
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

  // --- GET/PUT text ---
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

    // PUT — запись текста.
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '';
    const clean = rawPath.replace(/^disk:\//, '').replace(/^\/+/, '');
    writes.push({ method: 'PUT', path: `/text?path=${clean}` });

    // Создаём item, если нет.
    const segments = clean.split('/');
    const fileName = segments.pop()!;
    const parentPath = segments.join('/');
    if (!diskTree[parentPath]) diskTree[parentPath] = [];
    if (!diskTree[parentPath].some((i) => i.name === fileName)) {
      diskTree[parentPath].push({ type: 'file', name: fileName, path: clean });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, modified: '2024-11-08T20:16:00Z' }),
    });
  });

  // --- GET download ---
  // Реальная 1x1 PNG (валидная картинка), чтобы <img> не падал с @error.
  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );

  await page.route('**/api/yandex-self/download**', (route) => {
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '';
    const ext = rawPath.split('.').pop()?.toLowerCase() ?? '';

    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: TINY_PNG,
      });
    }

    return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'dummy' });
  });

  // --- POST /folder ---
  await page.route('**/api/yandex-self/folder', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();

    const body = (await route.request().postDataJSON()) as { path: string; name: string };
    const clean = (body.path ?? '/')
      .replace(/^disk:\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const name = body.name;
    writes.push({ method: 'POST', path: '/folder', body: { path: clean, name } });

    if (!diskTree[clean]) diskTree[clean] = [];
    if (diskTree[clean].some((i) => i.name === name)) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Папка уже существует' }),
      });
    }

    diskTree[clean].push({
      type: 'dir',
      name,
      path: clean ? `${clean}/${name}` : name,
    });
    diskTree[clean ? `${clean}/${name}` : name] = [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, path: clean ? `${clean}/${name}` : name }),
    });
  });

  // --- DELETE /resource ---
  await page.route('**/api/yandex-self/resource**', async (route: Route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();

    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '';
    const clean = rawPath.replace(/^disk:\//, '').replace(/^\/+/, '');
    writes.push({ method: 'DELETE', path: '/resource', body: { path: clean } });

    const segments = clean.split('/');
    const name = segments.pop()!;
    const parentPath = segments.join('/');
    const parentItems = diskTree[parentPath] ?? [];
    const idx = parentItems.findIndex((i) => i.name === name);

    if (idx === -1) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Ресурс не найден' }),
      });
    }

    const item = parentItems[idx];
    parentItems.splice(idx, 1);

    // Рекурсивное удаление вложенного поддерева.
    if (item.type === 'dir') {
      const prefix = clean + '/';
      for (const key of Object.keys(diskTree)) {
        if (key === clean || key.startsWith(prefix)) {
          delete diskTree[key];
        }
      }
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  // --- POST /move ---
  await page.route('**/api/yandex-self/move', async (route: Route) => {
    if (route.request().method() !== 'POST') return route.fallback();

    const body = (await route.request().postDataJSON()) as { fromPath: string; toPath: string };
    const cleanFrom = (body.fromPath ?? '').replace(/^disk:\//, '').replace(/^\/+/, '');
    const cleanTo = (body.toPath ?? '').replace(/^disk:\//, '').replace(/^\/+/, '');
    writes.push({ method: 'POST', path: '/move', body: { fromPath: cleanFrom, toPath: cleanTo } });

    const fromSegments = cleanFrom.split('/');
    const fromName = fromSegments.pop()!;
    const fromParent = fromSegments.join('/');
    const fromItems = diskTree[fromParent] ?? [];
    const idx = fromItems.findIndex((i) => i.name === fromName);
    if (idx === -1) {
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Ресурс не найден' }),
      });
    }

    const toSegments = cleanTo.split('/');
    const toName = toSegments.pop()!;
    const toParent = toSegments.join('/');
    if (!diskTree[toParent]) diskTree[toParent] = [];
    if (diskTree[toParent].some((i) => i.name === toName)) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Уже существует' }),
      });
    }

    const item = fromItems[idx];
    fromItems.splice(idx, 1);
    item.name = toName;
    item.path = cleanTo;
    diskTree[toParent].push(item);

    // Переименование поддерева: обходим ключи diskTree, начинающиеся с cleanFrom.
    if (item.type === 'dir') {
      const oldPrefix = cleanFrom;
      const newPrefix = cleanTo;
      const updates: Array<{ oldKey: string; newKey: string }> = [];
      for (const key of Object.keys(diskTree)) {
        if (key === oldPrefix) {
          updates.push({ oldKey: key, newKey: newPrefix });
        } else if (key.startsWith(oldPrefix + '/')) {
          updates.push({ oldKey: key, newKey: newPrefix + key.slice(oldPrefix.length) });
        }
      }
      for (const { oldKey, newKey } of updates) {
        if (oldKey === newKey) continue;
        diskTree[newKey] = diskTree[oldKey];
        delete diskTree[oldKey];
      }
      // Обновляем path у вложенных items.
      for (const [key, items] of Object.entries(diskTree)) {
        if (!key.startsWith(newPrefix) && key !== newPrefix) continue;
        for (const it of items) {
          it.path = key ? `${key}/${it.name}` : it.name;
        }
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, fromPath: cleanFrom, toPath: cleanTo }),
    });
  });

  // --- PUT /upload ---
  await page.route('**/api/yandex-self/upload**', async (route: Route) => {
    if (route.request().method() !== 'PUT') return route.fallback();

    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '';
    const name = url.searchParams.get('name') ?? '';
    const clean = rawPath.replace(/^disk:\//, '').replace(/^\/+/, '');
    writes.push({ method: 'PUT', path: '/upload', body: { path: clean, name } });

    if (!diskTree[clean]) diskTree[clean] = [];
    if (!diskTree[clean].some((i) => i.name === name)) {
      diskTree[clean].push({
        type: 'file',
        name,
        path: clean ? `${clean}/${name}` : name,
        isAudio: true,
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, path: clean ? `${clean}/${name}` : name }),
    });
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

  return { diskTree, writes };
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
      { timeout: 15000 },
    )
    .toBe(1);
}

// --- Хелперы навигации ---

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

const TAB_IDS: Record<'Трек' | 'Чат' | 'Галерея', string> = {
  Трек: 'track',
  Чат: 'chat',
  Галерея: 'gallery',
};

export async function clickTab(page: Page, tab: 'Трек' | 'Чат' | 'Галерея'): Promise<void> {
  await page.getByTestId(`logii-tab-${TAB_IDS[tab]}`).click();
}

// --- Хелперы чтения library ---

export async function readLibraryFolders(
  page: Page,
): Promise<Array<{ id: string; name: string; urlPath: string; parentId: string | null }> | null> {
  return page.evaluate(() => {
    const fn = (window as unknown as { __library?: () => unknown }).__library;
    if (!fn) return null;
    const lib = fn() as {
      folders: Record<string, { id: string; name: string; urlPath: string; parentId: string | null }>;
    };
    return Object.values(lib.folders);
  });
}

export async function readLibraryTracks(
  page: Page,
): Promise<Array<{ id: string; title: string; sourcesCount: number }> | null> {
  return page.evaluate(() => {
    const fn = (window as unknown as { __library?: () => unknown }).__library;
    if (!fn) return null;
    const lib = fn() as { tracks: Record<string, { id: string; title: string; sources: unknown[] }> };
    return Object.values(lib.tracks).map((t) => ({ id: t.id, title: t.title, sourcesCount: t.sources.length }));
  });
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
