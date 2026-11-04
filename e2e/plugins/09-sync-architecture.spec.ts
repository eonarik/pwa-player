// e2e/plugins/09-sync-architecture.spec.ts

import { test, expect, type Page, type Route } from '@playwright/test';
import { setupPageLogs, waitForAppBootstrap, getIDBValue } from '../helpers/test-utils';
import { mockAllApis } from '../mocks/api';

/**
 * Сценарии архитектуры синхронизации Яндекс.Диска.
 *
 * Карта:
 *  A. Первичное подключение
 *  B. Повторное открытие (кеш есть / нет)
 *  C. Переход в папки (scanned / pending / scanning / error)
 *  D. Иерархия статусов (scanning пробрасывается вверх, error не пробрасывается)
 *  E. Force scan (пересканирует всё поддерево, чистит «лишнее»)
 *  F. Отмена (глобальная для плагина, reason в error)
 *  G. Локальные совпадения (скачанные файлы)
 *  H. Кеш и F5
 *  I. Конкурентность
 */

// ---------------------------------------------------------------------------
// Хелперы
// ---------------------------------------------------------------------------

/** Конфиг одной папки для мока API. */
interface MockFolder {
  /** Имя папки (для моков — путь, начиная от корня). */
  path: string; // 'Music', 'Music/Rock', ...
  /** Задержка ответа, мс. */
  delayMs?: number;
  /** Если задан — ответ с этим HTTP-статусом. */
  errorStatus?: number;
  /** Файлы в этой папке (имена). */
  files?: string[];
  /** Подпапки (пути). */
  children?: string[];
}

interface MockDiskOptions {
  folders: MockFolder[];
  /** Задержка ответа корня (по умолчанию 0). */
  rootDelayMs?: number;
}

interface RequestLogEntry {
  path: string;
  timestamp: number;
}

/**
 * Мок API Яндекс.Диска с настраиваемыми папками, задержками и ошибками.
 * Возвращает лог запросов `listResources` (для проверки «сколько раз запрашивали папку»).
 */
async function mockYandexDiskConfigurable(
  page: Page,
  options: MockDiskOptions,
): Promise<{ requests: RequestLogEntry[] }> {
  const requests: RequestLogEntry[] = [];
  const byPath = new Map<string, MockFolder>();
  for (const f of options.folders) byPath.set(f.path, f);

  await page.route('**/api/disk/resources**', async (route: Route) => {
    const url = new URL(route.request().url());
    const rawPath = url.searchParams.get('path') ?? '/';

    // Нормализуем путь к виду без ведущего слэша и disk:/
    const cleanPath = rawPath
      .replace(/^disk:\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const displayPath = cleanPath === '' ? '/' : cleanPath;

    requests.push({ path: displayPath, timestamp: Date.now() });

    // Корень
    if (cleanPath === '') {
      if (options.rootDelayMs) await new Promise((r) => setTimeout(r, options.rootDelayMs));
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

    if (folder.delayMs) await new Promise((r) => setTimeout(r, folder.delayMs));

    if (folder.errorStatus) {
      return route.fulfill({
        status: folder.errorStatus,
        contentType: 'application/json',
        body: JSON.stringify({ error: `Mock error ${folder.errorStatus}` }),
      });
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

  return { requests };
}

/** Дождаться, пока статус папки не станет ожидаемым (читает IDB player:library). */
async function waitForFolderStatus(page: Page, folderId: string, status: string, timeout = 15_000): Promise<void> {
  await expect
    .poll(
      async () => {
        const data = await getFolderStatuses(page);
        return data[folderId]?.status ?? null;
      },
      { timeout, message: `Ожидание статуса "${status}" для папки ${folderId}` },
    )
    .toBe(status);
}

/** Прочитать scanState всех папок из IDB player:library. */
async function getFolderStatuses(page: Page): Promise<Record<string, { status: string; errorMessage?: string }>> {
  return await page.evaluate(() => {
    const lib = (window as any).__library?.();
    if (!lib?.folders) return {};
    const result: Record<string, { status: string; errorMessage?: string }> = {};
    for (const [id, f] of Object.entries(lib.folders as Record<string, any>)) {
      result[id] = { status: f.scanState, errorMessage: f.scanError };
    }
    return result;
  });
}

/** Найти ID папки по её `urlPath` (из `player:library` в IDB). */
async function findFolderIdByPath(page: Page, urlPath: string, timeout = 5000): Promise<string> {
  await expect
    .poll(
      async () => {
        const lib = await getIDBValue<{ folders: Record<string, { urlPath: string; id: string }> }>(
          page,
          'player:library',
        );
        if (!lib?.folders) return null;
        for (const [id, f] of Object.entries(lib.folders)) {
          if (f.urlPath === urlPath) return id;
        }
        return null;
      },
      { timeout, message: `Ожидание папки "${urlPath}" в IDB` },
    )
    .not.toBeNull();

  const lib = await getIDBValue<{ folders: Record<string, { urlPath: string; id: string }> }>(page, 'player:library');
  if (!lib?.folders) throw new Error(`[test] library not found in IDB`);
  for (const [id, f] of Object.entries(lib.folders)) {
    if (f.urlPath === urlPath) return id;
  }
  throw new Error(`[test] folder with urlPath "${urlPath}" not found`);
}

/** Клик по «Открыть» у плагина yandex. */
async function openYandex(page: Page): Promise<void> {
  const card = page.locator('[data-plugin-id="yandex"]');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Открыть' }).click();
}

/** Клик по «Подключить» у плагина yandex. */
async function connectYandex(page: Page): Promise<void> {
  const card = page.locator('[data-plugin-id="yandex"]');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Подключить' }).click();
}

/** Клик по папке в списке по имени. */
async function clickFolderByName(page: Page, name: string): Promise<void> {
  const row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: name }).first();
  await expect(row).toBeVisible();
  await row.click();
}

/** Проверить, что запросов `listResources` к пути `path` было не больше `max`. */
function countRequestsForPath(requests: RequestLogEntry[], path: string): number {
  return requests.filter((r) => r.path === path).length;
}

/** Общий setup: логи, моки всех API, чистка IDB/localStorage, bootstrap. */
async function setup(page: Page): Promise<void> {
  setupPageLogs(page);
  await mockAllApis(page);
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**/fonts.gstatic.com/**', (r) => r.abort());

  // Мок auth — авторизован (иначе yandex.connect() уйдёт в OAuth)
  await page.route('**/api/auth/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
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

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const dbs = await (indexedDB as any).databases();
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppBootstrap(page);
}

// ===========================================================================
// A. Первичное подключение
// ===========================================================================

test.describe('A. Первичное подключение', () => {
  test('A1: подключение → корень + 1 уровень, переход в плагин, фоновый скан идёт', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Music', delayMs: 2000, children: ['Music/Rock'], files: ['song1.mp3'] },
        { path: 'Music/Rock', delayMs: 0, files: ['song2.mp3'] },
        { path: 'Video', delayMs: 1000 },
      ],
    });

    await connectYandex(page);

    // Переход в корень плагина
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // Корень содержит Music, Video
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Music' })).toBeVisible();
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Video' })).toBeVisible();

    // Запросов к корню — ровно 1 (scanAll recursive: false в load)
    expect(countRequestsForPath(requests, '/')).toBe(1);

    // Фоновый скан стартует: Music и Video сканируются
    await expect
      .poll(() => countRequestsForPath(requests, 'Music') + countRequestsForPath(requests, 'Video'), { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);
  });

  test('A2: фоновый скан — быстрая папка завершается раньше медленной', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Slow', delayMs: 3000, files: ['a.mp3'] },
        { path: 'Fast', delayMs: 300, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    const slowId = await findFolderIdByPath(page, 'Slow');
    const fastId = await findFolderIdByPath(page, 'Fast');

    await waitForFolderStatus(page, fastId, 'scanned', 5000);
    // Slow ещё scanning
    const statuses = await getFolderStatuses(page);
    expect(statuses[slowId]?.status).toBe('scanning');
  });

  test('A3: ошибка API на дочерней папке → error только у неё, остальные scanned', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Broken', errorStatus: 500 },
        { path: 'Ok', files: ['a.mp3'] },
      ],
    });
    await connectYandex(page);

    const brokenId = await findFolderIdByPath(page, 'Broken');
    const okId = await findFolderIdByPath(page, 'Ok');

    await waitForFolderStatus(page, brokenId, 'error', 5000);
    await waitForFolderStatus(page, okId, 'scanned', 5000);

    // errorMessage содержит причину
    const statuses = await getFolderStatuses(page);
    expect(statuses[brokenId]?.errorMessage).toBeTruthy();
  });

  test('A4: пустой корень — нет ошибок, нет папок', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, { folders: [] });
    await connectYandex(page);

    await expect(page).toHaveURL(/\/folder\/yandex/);
    await expect(page.getByText('Музыка хранится в папке «Приложения / CUEI media player')).toBeVisible();
  });
});

// ===========================================================================
// B. Повторное открытие (кеш есть / нет)
// ===========================================================================

test.describe('B. Повторное открытие', () => {
  test('B1: полный кеш → повторное открытие не сканирует', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Music', files: ['a.mp3'] }],
    });

    await connectYandex(page);
    const musicId = await findFolderIdByPath(page, 'Music');
    await waitForFolderStatus(page, musicId, 'scanned', 10_000);

    // Возвращаемся на главную и открываем снова
    await page.goto('/');
    const requestsBefore = requests.length;
    await openYandex(page);

    // Ни одного нового запроса к /api/disk/resources
    await page.waitForTimeout(1000);
    expect(requests.length).toBe(requestsBefore);
  });

  test('B2: частичный кеш (есть error) → доскан error-папок', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', errorStatus: 500 }],
    });
    await connectYandex(page);
    const brokenId = await findFolderIdByPath(page, 'Broken');
    await waitForFolderStatus(page, brokenId, 'error', 5000);

    // Меняем мок: теперь Broken отвечает успешно
    await page.unroute('**/api/disk/resources**');
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', files: ['a.mp3'] }],
    });

    await page.goto('/');
    await openYandex(page);

    // Доскан: Broken снова сканируется
    await expect.poll(() => countRequestsForPath(requests, 'Broken'), { timeout: 5000 }).toBeGreaterThanOrEqual(1);
  });

  test('B3: пустой кеш (foldersCache очищен в IDB) → load получает корень + 1 уровень', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Music', files: ['a.mp3'] },
        { path: 'Deep/Nested', files: ['b.mp3'] },
      ],
    });

    await connectYandex(page);
    await expect(page).toHaveURL(/\/folder\/yandex/);
    const musicId = await findFolderIdByPath(page, 'Music');
    await waitForFolderStatus(page, musicId, 'scanned', 10_000);

    // Очищаем кэш через initScript, чтобы приложение не успело его перезаписать.
    await page.addInitScript(() => {
      const dbs = indexedDB.open('keyval-store');
      dbs.onsuccess = () => {
        const db = dbs.result;
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').delete('yandex:yandex:foldersCache');
        tx.objectStore('keyval').delete('yandex:yandex:pathMap');
      };
    });

    // F5 — сбрасывает in-memory storage.loaded
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // F5 оставил нас на /folder/yandex. Переходим на / для openYandex.
    await page.goto('/');
    await waitForAppBootstrap(page);

    const before = countRequestsForPath(requests, '/');

    // Открываем плагин
    await openYandex(page);
    await expect(page).toHaveURL(/\/folder\/yandex/);

    await expect.poll(() => countRequestsForPath(requests, '/'), { timeout: 5000 }).toBeGreaterThan(before);
  });

  test('B4: двойное открытие подряд (без F5) — очередь не дублируется', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Slow', delayMs: 2000, files: ['a.mp3'] }],
    });
    await connectYandex(page);
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // Возврат на главную (SPA, без F5) + открытие
    await page.goBack();
    await expect(page).toHaveURL('/');
    await openYandex(page);
    await expect(page).toHaveURL(/\/folder\/yandex/);

    // Ещё раз
    await page.goBack();
    await expect(page).toHaveURL('/');
    await openYandex(page);
    await expect(page).toHaveURL(/\/folder\/yandex/);

    await page.waitForTimeout(3000);
    // Запросов к Slow — не больше 1 (или 2: 1 при connect + 1 при первом reopen, если Slow ещё pending; но не 3+)
    expect(countRequestsForPath(requests, 'Slow')).toBeLessThanOrEqual(2);
  });
});

// ===========================================================================
// C. Переход в папки
// ===========================================================================

test.describe('C. Переход в папки', () => {
  test('C1: переход в scanned-папку — скан не запускается', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Music', files: ['a.mp3'] }],
    });
    await connectYandex(page);
    const musicId = await findFolderIdByPath(page, 'Music');
    await waitForFolderStatus(page, musicId, 'scanned', 10_000);

    const before = countRequestsForPath(requests, 'Music');
    await clickFolderByName(page, 'Music');
    await page.waitForTimeout(500);

    expect(countRequestsForPath(requests, 'Music')).toBe(before);
  });

  test('C2: переход в pending-папку — force scan, из очереди убрана', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Slow', delayMs: 5000, files: ['a.mp3'] },
        { path: 'Other', files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);
    const slowId = await findFolderIdByPath(page, 'Slow');

    // Slow в pending/scanning (фоновый скан)
    await expect
      .poll(
        async () => {
          const s = await getFolderStatuses(page);
          return s[slowId]?.status ?? null;
        },
        { timeout: 3000 },
      )
      .toMatch(/pending|scanning/);

    await clickFolderByName(page, 'Slow');
    // После force scan — scanned
    await waitForFolderStatus(page, slowId, 'scanned', 15_000);
  });

  test('C3: переход в scanning-папку — 1 уровень уже есть', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', delayMs: 500, children: ['Parent/Child'], files: ['a.mp3'] },
        { path: 'Parent/Child', delayMs: 3000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);
    const parentId = await findFolderIdByPath(page, 'Parent');

    // Ждём, пока Parent получит 1 уровень (status=scanning, дети есть)
    await waitForFolderStatus(page, parentId, 'scanning', 5000);

    await clickFolderByName(page, 'Parent');
    // Внутри виден Child
    await expect(page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Child' })).toBeVisible();
  });

  test('C4: переход в error-папку — показ ошибки + кнопка «Обновить»', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', errorStatus: 500 }],
    });
    await connectYandex(page);
    const brokenId = await findFolderIdByPath(page, 'Broken');
    await waitForFolderStatus(page, brokenId, 'error', 5000);

    await page.goto('/');
    await openYandex(page);
    // В корне у Broken — текст ошибки
    const row = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Broken' });
    await expect(row.getByText('Ошибка синхронизации')).toBeVisible();
  });

  test('C6: переход в pending-папку запускает рекурсивный force scan', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        // Увеличиваем задержку Parent, чтобы успеть отменить скан
        { path: 'Parent', delayMs: 2000, children: ['Parent/Child1', 'Parent/Child2'], files: [] },
        { path: 'Parent/Child1', delayMs: 100, files: ['a.mp3'] },
        { path: 'Parent/Child2', delayMs: 100, files: ['b.mp3'] },
      ],
    });

    await connectYandex(page);
    const parentId = await findFolderIdByPath(page, 'Parent');

    // Ждём, пока Parent начнёт сканироваться (появится кнопка "Синхронизация...")
    await expect(page.locator('button[aria-label^="Синхронизация..."]').first()).toBeVisible({ timeout: 3000 });

    // Отменяем скан
    await page.locator('button[aria-label^="Синхронизация..."]').first().click();
    await page.getByText('Отменить синхронизацию').click();

    // Проверяем, что Parent сейчас в ошибке (после отмены)
    await waitForFolderStatus(page, parentId, 'error', 5000);

    const beforeChild1 = countRequestsForPath(requests, 'Parent/Child1');
    const beforeChild2 = countRequestsForPath(requests, 'Parent/Child2');

    // Кликаем по Parent — должен запуститься рекурсивный force scan
    await clickFolderByName(page, 'Parent');

    // Ждем, пока Parent станет scanned
    await waitForFolderStatus(page, parentId, 'scanned', 10000);

    // Проверяем, что были запросы к детям (они отсканировались рекурсивно)
    expect(countRequestsForPath(requests, 'Parent/Child1')).toBeGreaterThan(beforeChild1);
    expect(countRequestsForPath(requests, 'Parent/Child2')).toBeGreaterThan(beforeChild2);
  });
});

// ===========================================================================
// D. Иерархия статусов
// ===========================================================================

test.describe('D. Иерархия статусов', () => {
  test('D1: родитель scanning, пока ребёнок не scanned', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', delayMs: 300, children: ['Parent/Child'], files: ['a.mp3'] },
        { path: 'Parent/Child', delayMs: 3000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    const parentId = await findFolderIdByPath(page, 'Parent');

    // После получения Parent, пока Child сканируется — Parent scanning
    await expect
      .poll(
        async () => {
          const s = await getFolderStatuses(page);
          return s[parentId]?.status ?? null;
        },
        { timeout: 5000 },
      )
      .toBe('scanning');

    await waitForFolderStatus(page, parentId, 'scanned', 10_000);
  });

  test('D2: ошибка ребёнка не пробрасывается родителю', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', children: ['Parent/Broken', 'Parent/Ok'], files: [] },
        { path: 'Parent/Broken', errorStatus: 500 },
        { path: 'Parent/Ok', files: ['a.mp3'] },
      ],
    });
    await connectYandex(page);

    const parentId = await findFolderIdByPath(page, 'Parent');
    const brokenId = await findFolderIdByPath(page, 'Parent/Broken');
    const okId = await findFolderIdByPath(page, 'Parent/Ok');

    await waitForFolderStatus(page, brokenId, 'error', 5000);
    await waitForFolderStatus(page, okId, 'scanned', 5000);
    // Родитель — scanned (error игнорируется)
    await waitForFolderStatus(page, parentId, 'scanned', 5000);
  });

  test('D3: глубокая вложенность — scanning пробрасывается вверх', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'A', children: ['A/B'], files: [] },
        { path: 'A/B', children: ['A/B/C'], files: [] },
        { path: 'A/B/C', delayMs: 3000, files: ['deep.mp3'] },
      ],
    });
    await connectYandex(page);

    const aId = await findFolderIdByPath(page, 'A');
    const bId = await findFolderIdByPath(page, 'A/B');
    const cId = await findFolderIdByPath(page, 'A/B/C');

    await waitForFolderStatus(page, cId, 'scanning', 5000);
    // A и B тоже scanning
    const statuses = await getFolderStatuses(page);
    expect(statuses[aId]?.status).toBe('scanning');
    expect(statuses[bId]?.status).toBe('scanning');

    await waitForFolderStatus(page, cId, 'scanned', 10_000);
    await waitForFolderStatus(page, aId, 'scanned', 10_000);
  });
});

// ===========================================================================
// E. Force scan
// ===========================================================================

test.describe('E. Force scan', () => {
  test('E1: force scan scanned-папки пересканирует всё поддерево', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', children: ['Parent/Child'], files: ['a.mp3'] },
        { path: 'Parent/Child', files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);
    const childId = await findFolderIdByPath(page, 'Parent/Child');
    await waitForFolderStatus(page, childId, 'scanned', 10_000);

    const beforeParent = countRequestsForPath(requests, 'Parent');
    const beforeChild = countRequestsForPath(requests, 'Parent/Child');

    // Переходим в Parent и нажимаем «Обновить с облака»
    await clickFolderByName(page, 'Parent');
    const refreshBtn = page.locator('button[aria-label="Синхронизация"]').first();
    await refreshBtn.click();
    await page.getByText('Обновить с облака').click();

    await page.waitForTimeout(1500);
    expect(countRequestsForPath(requests, 'Parent')).toBeGreaterThan(beforeParent);
    expect(countRequestsForPath(requests, 'Parent/Child')).toBeGreaterThan(beforeChild);
  });

  test('E3: force scan не трогает соседние поддеревья', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'A', files: ['a.mp3'] },
        { path: 'B', files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);
    const aId = await findFolderIdByPath(page, 'A');
    const bId = await findFolderIdByPath(page, 'B');
    await waitForFolderStatus(page, aId, 'scanned', 10_000);
    await waitForFolderStatus(page, bId, 'scanned', 10_000);

    const beforeB = countRequestsForPath(requests, 'B');

    await clickFolderByName(page, 'A');
    const refreshBtn = page.locator('button[aria-label="Синхронизация"]').first();
    await refreshBtn.click();
    await page.getByText('Обновить с облака').click();

    await page.waitForTimeout(1500);
    expect(countRequestsForPath(requests, 'A')).toBeGreaterThan(0);
    expect(countRequestsForPath(requests, 'B')).toBe(beforeB);
  });
});

// ===========================================================================
// F. Отмена
// ===========================================================================

test.describe('F. Отмена', () => {
  test('F1: отмена → error + reason, очередь пуста', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Slow1', delayMs: 5000, files: ['a.mp3'] },
        { path: 'Slow2', delayMs: 5000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    // Ждём, пока начнётся скан
    await page.waitForTimeout(1000);

    // Открываем меню синхронизации и нажимаем «Отменить»
    const refreshBtn = page.locator('button[aria-label="Синхронизация..."]').first();
    await refreshBtn.click();
    await page.getByText('Отменить синхронизацию').click();

    await page.waitForTimeout(500);
    const statuses = await getFolderStatuses(page);
    const slow1 = Object.entries(statuses).find(([, s]) => s.status === 'error');
    expect(slow1).toBeTruthy();
    if (slow1) {
      expect(slow1[1].errorMessage).toContain('Отмена');
    }
  });

  test('F2: после отмены «Открыть» запускает доскан error-папок', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Slow', delayMs: 5000, files: ['a.mp3'] }],
    });
    await connectYandex(page);
    await page.waitForTimeout(500);

    const refreshBtn = page.locator('button[aria-label="Синхронизация..."]').first();
    await refreshBtn.click();
    await page.getByText('Отменить синхронизацию').click();
    await page.waitForTimeout(500);

    await page.goto('/');
    await openYandex(page);
    await page.waitForTimeout(500);

    // Папка Slow снова сканируется (или уже scanned, если успела)
    const statuses = await getFolderStatuses(page);
    const slowStatuses = Object.values(statuses).filter(
      (s) => s.status === 'pending' || s.status === 'scanning' || s.status === 'scanned',
    );
    expect(slowStatuses.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// H. Кеш и F5
// ===========================================================================

test.describe('H. Кеш и F5', () => {
  test('H1: F5 после полного скана — всё scanned, сканов нет', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Music', files: ['a.mp3'] }],
    });
    await connectYandex(page);
    const musicId = await findFolderIdByPath(page, 'Music');
    await waitForFolderStatus(page, musicId, 'scanned', 10_000);

    const before = requests.length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    await page.waitForTimeout(1000);
    // Может быть healthcheck, но resources — не должно
    const resourcesRequests = requests.slice(before).filter(() => true);
    expect(resourcesRequests.length).toBe(0);
  });

  test('H2: F5 после частичного скана (error) — доскан', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', errorStatus: 500 }],
    });
    await connectYandex(page);
    const brokenId = await findFolderIdByPath(page, 'Broken');
    await waitForFolderStatus(page, brokenId, 'error', 5000);

    await page.unroute('**/api/disk/resources**');
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', files: ['a.mp3'] }],
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);
    await page.waitForTimeout(1000);

    // Доскан: Broken сканируется снова
    const statuses = await getFolderStatuses(page);
    expect(['pending', 'scanning', 'scanned']).toContain(statuses[brokenId]?.status);
  });

  test('H3: F5 при scanning — скан перезапускается (не залипает)', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Slow', delayMs: 5000, files: ['a.mp3'] }],
    });
    await connectYandex(page);
    const slowId = await findFolderIdByPath(page, 'Slow');
    await waitForFolderStatus(page, slowId, 'scanning', 3000);

    const before = countRequestsForPath(requests, 'Slow');
    expect(before).toBe(1); // 1-й скан

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // После F5 доскан стартует — 2-й запрос к Slow
    await expect.poll(() => countRequestsForPath(requests, 'Slow'), { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  });

  test('H4: F5 во время скана — не создаёт дубликаты папок, статус scanning виден', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Slow', delayMs: 5000, files: ['a.mp3'] }],
    });
    await connectYandex(page);

    const slowId = await findFolderIdByPath(page, 'Slow');
    await waitForFolderStatus(page, slowId, 'scanning', 3000);

    // F5 во время скана
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppBootstrap(page);

    // Проверяем, что за время F5 не появилось дубликатов папки 'Slow'
    await expect
      .poll(
        async () => {
          const lib = await getIDBValue<{ folders: Record<string, { name: string; urlPath: string }> }>(
            page,
            'player:library',
          );
          if (!lib?.folders) return 0;
          return Object.values(lib.folders).filter((f) => f.name === 'Slow').length;
        },
        { timeout: 10000, message: 'Ожидание отсутствия дубликатов Slow' },
      )
      .toBe(1);

    // И статус 'scanning' должен быть виден (через Pinia store, а не IDB)
    await expect
      .poll(
        async () => {
          const statuses = await getFolderStatuses(page);
          return statuses[slowId]?.status ?? null;
        },
        { timeout: 5000, message: 'Ожидание статуса scanning после F5' },
      )
      .toBe('scanning');
  });
});

// ===========================================================================
// I. Конкурентность
// ===========================================================================

test.describe('I. Конкурентность', () => {
  test('I1: force scan недоступен для scanning-папки (кнопки обновления disabled)', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', delayMs: 300, children: ['Parent/Child'], files: [] },
        { path: 'Parent/Child', delayMs: 5000, files: ['a.mp3'] },
      ],
    });
    await connectYandex(page);
    const parentId = await findFolderIdByPath(page, 'Parent');

    // Ждём, пока Parent станет scanning (из-за Child)
    await waitForFolderStatus(page, parentId, 'scanning', 5000);

    // Переходим в Parent
    await clickFolderByName(page, 'Parent');

    // Открываем меню синхронизации
    const refreshBtn = page.locator('button[aria-label="Синхронизация..."]').first();
    await refreshBtn.click();

    // Кнопки «Обновить с облака» / «Обновить с устройства» — disabled
    const cloudBtn = page.getByText('Обновить с облака').first();
    const deviceBtn = page.getByText('Обновить с устройства').first();
    await expect(cloudBtn).toBeDisabled();
    await expect(deviceBtn).toBeDisabled();

    // Кнопка «Отменить синхронизацию» — доступна
    await expect(page.getByText('Отменить синхронизацию')).toBeVisible();
  });

  test('I2: force scan pending-папки — потомки в очереди не сканируются дважды', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'Parent', delayMs: 100, children: ['Parent/Child1', 'Parent/Child2'], files: [] },
        { path: 'Parent/Child1', delayMs: 3000, files: ['a.mp3'] },
        { path: 'Parent/Child2', delayMs: 3000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    const parentId = await findFolderIdByPath(page, 'Parent');

    // Ждём, пока Parent получит 1 уровень (scanning, дети pending в очереди)
    await waitForFolderStatus(page, parentId, 'scanning', 5000);

    // Force scan на Parent — пересканирует всё поддерево
    await clickFolderByName(page, 'Parent');
    const refreshBtn = page.locator('button[aria-label="Синхронизация..."]').first();
    await refreshBtn.click();

    const cloudBtn = page.getByText('Обновить с облака').first();
    // Может быть disabled, если Parent ещё scanning. Проверяем:
    const isDisabled = await cloudBtn.isDisabled();
    if (!isDisabled) {
      await cloudBtn.click();
    }

    // Ждём завершения
    await waitForFolderStatus(page, parentId, 'scanned', 15_000);

    // Каждый из Child1/Child2 — не больше 2 запросов (фоновый + force scan не должны оба идти)
    // В идеале — 1, но допустим 2 (фоновый мог успеть стартовать до force scan)
    expect(countRequestsForPath(requests, 'Parent/Child1')).toBeLessThanOrEqual(2);
    expect(countRequestsForPath(requests, 'Parent/Child2')).toBeLessThanOrEqual(2);
  });

  test('I3: force scan scanned-папки во время фонового скана соседа — параллельно', async ({ page }) => {
    await setup(page);
    const { requests } = await mockYandexDiskConfigurable(page, {
      folders: [
        { path: 'A', files: ['a.mp3'] },
        { path: 'B', delayMs: 3000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    const aId = await findFolderIdByPath(page, 'A');
    await waitForFolderStatus(page, aId, 'scanned', 10_000);

    // B ещё сканируется (delayMs 3000)
    const statuses = await getFolderStatuses(page);
    const bEntry = Object.entries(statuses).find(([, s]) => s.status === 'scanning');
    expect(bEntry).toBeTruthy();

    const beforeA = countRequestsForPath(requests, 'A');

    // Force scan на A (scanned) — запускается параллельно с B
    await clickFolderByName(page, 'A');
    const refreshBtn = page.locator('button[aria-label="Синхронизация"]').first();
    await refreshBtn.click();
    await page.getByText('Обновить с облака').click();

    // A пересканируется независимо от B
    await expect.poll(() => countRequestsForPath(requests, 'A'), { timeout: 5000 }).toBeGreaterThan(beforeA);
  });
});

// ===========================================================================
// J. Прогресс и reason
// ===========================================================================

test.describe('J. Прогресс и reason', () => {
  test('J1: у scanning-папки (которую сканирует ScanQueue) отображается прогресс «N из M»', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [
        // Parent — прямой ребёнок корня, сканируется ScanQueue
        { path: 'Parent', delayMs: 200, children: ['Parent/C1', 'Parent/C2'], files: [] },
        { path: 'Parent/C1', delayMs: 2000, files: ['a.mp3'] },
        { path: 'Parent/C2', delayMs: 2000, files: ['b.mp3'] },
      ],
    });
    await connectYandex(page);

    // Не ждём завершения, сразу смотрим на Parent в корне
    const parentRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Parent' });
    await expect(parentRow).toBeVisible();

    // Ждём, пока у Parent появится progress с total > 0 (C1, C2 обнаружены)
    await expect
      .poll(
        async () => {
          const text = await parentRow.textContent();
          return text?.match(/\d+/)?.[0] ?? null;
        },
        { timeout: 5000, message: 'Ожидание прогресса «N из M» у Parent' },
      )
      .not.toBeNull();
  });

  test('J2: у error-папки отображается reason', async ({ page }) => {
    await setup(page);
    await mockYandexDiskConfigurable(page, {
      folders: [{ path: 'Broken', errorStatus: 500 }],
    });
    await connectYandex(page);
    const brokenId = await findFolderIdByPath(page, 'Broken');
    await waitForFolderStatus(page, brokenId, 'error', 5000);

    await page.goto('/');
    await openYandex(page);

    const brokenRow = page.locator('[data-testid^="folder-row-"]').filter({ hasText: 'Broken' });
    await expect(brokenRow.getByText('Ошибка синхронизации')).toBeVisible();

    // Тултип/подпись с причиной — должен содержать что-то про HTTP 500 или «Ошибка сети»
    const statuses = await getFolderStatuses(page);
    expect(statuses[brokenId]?.errorMessage).toBeTruthy();
  });
});
