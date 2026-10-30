// e2e/mocks/api/auth.ts

import { Page } from '@playwright/test';

export async function mockAuth(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false }),
    }),
  );
}
