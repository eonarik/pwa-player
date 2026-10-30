// e2e/mocks/api/yandex.ts

import { Page } from '@playwright/test';

export async function mockYandex(page: Page) {
  await page.route('**/api/disk/**', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'Not connected' }) }),
  );
  await page.route('**/api/yandex-self/**', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) }),
  );
}
