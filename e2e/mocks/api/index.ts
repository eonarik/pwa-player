// e2e/mocks/api/index.ts

import { Page } from '@playwright/test';
import { mockAuth } from './auth';
import { mockMetadata } from './metadata';
import { mockYandex } from './yandex';
import { mockRadio } from './radio';
import { mockPodcasts } from './podcasts';
import { mockZvuk } from './zvuk';
import { mockYandexDisk } from './yandex-disk';

export async function mockAllApis(page: Page) {
  await mockAuth(page);
  await mockMetadata(page);
  await mockYandex(page);
  await mockRadio(page);
  await mockPodcasts(page);
  await mockZvuk(page);
  await mockYandexDisk(page);
}
