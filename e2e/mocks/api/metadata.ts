// e2e/mocks/api/metadata.ts

import { Page } from '@playwright/test';

export async function mockMetadata(page: Page) {
  await page.route('**/api/track-metadata*', async (route) => {
    const url = new URL(route.request().url());
    const title = url.searchParams.get('title');
    const artist = url.searchParams.get('artist');

    // 1. Сценарий: строгий мэтч (Track 1 -> Mocked Title)
    if (title === 'Track 1' && artist === 'Artist A') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artist: 'Artist A', // Строгое совпадение
          title: 'Mocked Title',
          album: 'Mocked Album',
          coverUrl: 'https://example.com/mocked-cover.jpg',
          source: 'itunes',
          similarity: 1,
          confident: true,
        }),
      });
    }

    // 2. Сценарий: нестрогий мэтч (30 Seconds to Mars -> Thirty Seconds to Mars)
    if (title === 'The Kill' && artist === '30 Seconds to Mars') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artist: 'Thirty Seconds to Mars', // Нестрогое совпадение
          title: 'The Kill',
          album: 'A Beautiful Lie',
          coverUrl: 'https://example.com/mars-cover.jpg',
          source: 'itunes',
          similarity: 0.95,
          confident: true,
        }),
      });
    }

    // 3. Сценарий: не найдено
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null),
    });
  });

  // Мокаем картинки обложек
  await page.route('**/mocked-cover.jpg', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64',
      ),
    }),
  );

  await page.route('**/mars-cover.jpg', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64',
      ),
    }),
  );
}
