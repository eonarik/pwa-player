// e2e/mocks/api/metadata.ts

import { Page } from '@playwright/test';

export async function mockMetadata(page: Page) {
  await page.route('**/api/track-metadata*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null), // not-found
    }),
  );
}
