// e2e/plugins/14-force-scan-diff.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

interface MockFolder {
  path: string;
  files?: string[];
  children?: string[];
}

interface MockDiskOptions {
  folders: MockFolder[];
}

async function mockYandexDiskConfigurable(page: Page, options: MockDiskOptions): Promise<void> {
  const byPath = new Map<string, MockFolder>();
  for (const f of options.folders) byPath.set(f.path, f);

  await page.route('**/api/disk/resources**', async (route: Route) => {
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '/';

    const cleanPath = rawPath
      .replace(/^disk:\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

    // Корень
    if (cleanPath === '') {
      const rootFolders = options.folders.filter((f) => !f.path.includes('/'));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: rootFolders.map((f) => ({
            type: 'dir',
            name: f.path,
            path: `disk:/${f.path}`,
          })),
        }),
      });
    }

    const folder = byPath.get(cleanPath);
    if (!folder) {
      return route.fulfill({ status: 404, body: 'Not found' });
    }

    const items: Array<Record<string, unknown>> = [];
    for (const child of folder.children ?? []) {
      const name = child.split('/').pop()!;
      items.push({ type: 'dir', name, path: `disk:/${child}` });
    }
    for (const file of folder.files ?? []) {
      items.push({ type: 'file', name: file, path: `disk:/${cleanPath}/${file}`, isAudio: true });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
    });
  });
}

async function setupYandex(page: Page, folders: MockFolder[]): Promise<void> {
  setupPageLogs(page);
  await mockAllApis(page);
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());

  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
  );

  await mockYandexDiskConfigurable(page, { folders });

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
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppBootstrap(page);

  const card = page.locator('[data-plugin-id="yandex"]');
  await card.getByRole('button', { name: 'Подключить' }).click();
  await expect(page).toHaveURL(/\/folder\/yandex/);
}

async function replaceMockDisk(page: Page, folders: MockFolder[]): Promise<void> {
  await page.unroute('**/api/disk/resources**');
  await mockYandexDiskConfigurable(page, { folders });
}

async function waitForFolderByUrlPath(page: Page, urlPath: string, timeout = 15000): Promise<void> {
  await expect
    .poll(
      async () => {
        const lib = await getIDBValue<{ folders: Record<string, { urlPath: string }> }>(page, 'player:library');
        if (!lib?.folders) return false;
        return Object.values(lib.folders).some((f) => f.urlPath === urlPath);
      },
      { timeout, message: `Ожидание папки "${urlPath}" в IDB` },
    )
    .toBe(true);
}

async function waitForFolderNotExists(page: Page, urlPath: string, timeout = 15000): Promise<void> {
  await expect
    .poll(
      async () => {
        const lib = await getIDBValue<{ folders: Record<string, { urlPath: string }> }>(page, 'player:library');
        if (!lib?.folders) return true;
        return !Object.values(lib.folders).some((f) => f.urlPath === urlPath);
      },
      { timeout, message: `Ожидание отсутствия папки "${urlPath}" в IDB` },
    )
    .toBe(true);
}

/** Найти ID папки по urlPath. */
async function findFolderIdByPath(page: Page, urlPath: string): Promise<string | null> {
  const lib = await getIDBValue<{ folders: Record<string, { id: string; urlPath: string }> }>(page, 'player:library');
  if (!lib?.folders) return null;
  for (const [id, f] of Object.entries(lib.folders)) {
    if (f.urlPath === urlPath) return id;
  }
  return null;
}

/** Открыть меню синхронизации и нажать «Обновить с облака». */
async function triggerForceScan(page: Page): Promise<void> {
  const refreshBtn = page.locator('button[aria-label="Синхронизация"]').first();
  await expect(refreshBtn).toBeVisible();
  await refreshBtn.click();

  const cloudBtn = page.getByText('Обновить с облака').first();
  await expect(cloudBtn).toBeVisible();
  await cloudBtn.click();
}

async function openFolder(page: Page, name: string): Promise<void> {
  const row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: name }).first();
  await expect(row).toBeVisible();
  await row.click();
}

// ===========================================================================
// Тесты
// ===========================================================================

test.describe('Yandex Disk: Force scan — diff (удаление / переименование / добавление)', () => {
  test('удаление папки на Диске → после force scan папка исчезает из библиотеки', async ({ page }) => {
    await setupYandex(page, [
      { path: 'Music', children: ['Music/Rock'], files: ['song1.mp3'] },
      { path: 'Music/Rock', files: ['rock1.mp3'] },
    ]);

    // Открываем Music
    await openFolder(page, 'Music');
    await waitForFolderByUrlPath(page, 'Music/Rock');

    // Убеждаемся, что Rock есть в UI
    const rockRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Rock' }).first();
    await expect(rockRow).toBeVisible();

    // «Удаляем» Rock на Диске: Music → [] (без Rock)
    await replaceMockDisk(page, [{ path: 'Music', files: ['song1.mp3'] }]);

    // Force scan на Music
    await triggerForceScan(page);

    // Rock исчезает
    await waitForFolderNotExists(page, 'Music/Rock');
    await expect(rockRow).toBeHidden();
  });

  test('переименование папки на Диске → после force scan старая исчезает, новая появляется', async ({ page }) => {
    await setupYandex(page, [
      { path: 'Music', children: ['Music/Rock'], files: [] },
      { path: 'Music/Rock', files: [] },
    ]);

    await openFolder(page, 'Music');
    await waitForFolderByUrlPath(page, 'Music/Rock');

    const oldId = await findFolderIdByPath(page, 'Music/Rock');
    expect(oldId).not.toBeNull();

    const rockRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Rock' }).first();
    await expect(rockRow).toBeVisible();

    // «Переименовываем» Rock → Metal на Диске
    await replaceMockDisk(page, [
      { path: 'Music', children: ['Music/Metal'], files: [] },
      { path: 'Music/Metal', files: [] },
    ]);

    await triggerForceScan(page);

    // Старая папка исчезла, новая появилась
    await waitForFolderNotExists(page, 'Music/Rock');
    await waitForFolderByUrlPath(page, 'Music/Metal');

    const newId = await findFolderIdByPath(page, 'Music/Metal');
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(oldId);

    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Metal' }).first()).toBeVisible();
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Rock' })).toHaveCount(0);
  });

  test('добавление новой папки на Диске → после force scan появляется, старая остаётся', async ({ page }) => {
    await setupYandex(page, [
      { path: 'Music', children: ['Music/Rock'], files: [] },
      { path: 'Music/Rock', files: [] },
    ]);

    await openFolder(page, 'Music');
    await waitForFolderByUrlPath(page, 'Music/Rock');

    const rockId = await findFolderIdByPath(page, 'Music/Rock');
    expect(rockId).not.toBeNull();

    // «Добавляем» Jazz на Диске
    await replaceMockDisk(page, [
      { path: 'Music', children: ['Music/Rock', 'Music/Jazz'], files: [] },
      { path: 'Music/Rock', files: [] },
      { path: 'Music/Jazz', files: [] },
    ]);

    await triggerForceScan(page);

    // Jazz появился, Rock остался
    await waitForFolderByUrlPath(page, 'Music/Jazz');
    await waitForFolderByUrlPath(page, 'Music/Rock');

    const newRockId = await findFolderIdByPath(page, 'Music/Rock');
    expect(newRockId).toBe(rockId); // id сохранился

    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Jazz' }).first()).toBeVisible();
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Rock' }).first()).toBeVisible();
  });
});
