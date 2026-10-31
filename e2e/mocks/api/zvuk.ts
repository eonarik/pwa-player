// e2e/mocks/api/zvuk.ts

import { Page } from '@playwright/test';

export async function mockZvuk(page: Page) {
  await page.route('**/api/zvuk/search*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tracks: [
          {
            id: 'zvuk-1',
            title: 'Test Zvuk Track',
            duration: 180,
            artists: [{ id: 'artist-1', title: 'Zvuk Artist' }],
            release: {
              title: 'Zvuk Album',
              image: { src: 'https://example.com/zvuk.jpg' },
            },
          },
        ],
        artists: [],
        releases: [],
      }),
    }),
  );

  await page.route('**/api/zvuk/stream*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: 'dummy-audio-data',
    }),
  );

  await page.route('**/api/zvuk/metadata*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null),
    }),
  );
}
