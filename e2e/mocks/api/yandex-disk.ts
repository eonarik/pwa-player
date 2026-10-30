// e2e/mocks/api/yandex-disk.ts

import { Page } from '@playwright/test';

export async function mockYandexDisk(page: Page) {
  // 1. Healthcheck (используется в YandexDiskService.ping)
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    }),
  );

  // 2. Авторизация
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true }),
    }),
  );

  // 3. Список ресурсов (папки и файлы)
  await page.route('**/api/disk/resources**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.searchParams.get('path');

    // Корень
    if (path === '/' || path === 'disk:/') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { type: 'dir', name: 'Artist A', path: 'disk:/Artist A' },
            { type: 'file', name: 'root_track.mp3', path: 'disk:/root_track.mp3', isAudio: true },
          ],
        }),
      });
    }

    // Вложенная папка (с задержкой для проверки лоадера)
    if (path === '/Artist A' || path === 'disk:/Artist A') {
      await new Promise((r) => setTimeout(r, 1000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ type: 'file', name: 'track1.mp3', path: 'disk:/Artist A/track1.mp3', isAudio: true }],
        }),
      });
    }

    return route.fulfill({ status: 404, body: 'Not found' });
  });

  // 4. Скачивание (если понадобится)
  await page.route('**/api/disk/download**', (route) => route.fulfill({ status: 200, body: 'dummy-audio-data' }));
}
