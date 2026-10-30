// e2e/helpers/api-mock.ts

import { Page } from '@playwright/test';

export async function mockApi(page: Page) {
  // 1. Мокаем все запросы к /api/*
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // Health check / auth me
    if (path === '/api/auth/me') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      });
    }

    // Metadata (iTunes/Deezer)
    if (path === '/api/track-metadata') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null), // not-found
      });
    }

    // Yandex Disk
    if (path.startsWith('/api/disk/')) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not connected' }),
      });
    }

    // Yandex Self
    if (path.startsWith('/api/yandex-self/')) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    }

    // Podcasts proxy
    if (path === '/api/podcasts/proxy') {
      return route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: '<?xml version="1.0"?><rss></rss>',
      });
    }

    // Zvuk
    if (path.startsWith('/api/zvuk/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tracks: [], artists: [], releases: [] }),
      });
    }

    // HLS proxy
    if (path === '/api/hls-proxy') {
      return route.fulfill({ status: 404 });
    }

    // Fallback для всех остальных /api
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
}
