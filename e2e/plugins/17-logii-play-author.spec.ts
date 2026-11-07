// e2e/plugins/17-logii-play-author.spec.ts

import { test, expect } from '@playwright/test';
import {
  mockLogii,
  bootstrapLogii,
  openLogiiSeason,
  readPlayerQueue,
  readIsPlaying,
  type DiskItem,
} from '../helpers/logii-helpers';

const SEASON = 'logii.2024-11-08';

const TREE: Record<string, DiskItem[]> = {
  '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
  [SEASON]: [
    { type: 'dir', name: 'userA', path: `disk:/${SEASON}/userA` },
    { type: 'dir', name: 'userB', path: `disk:/${SEASON}/userB` },
  ],
  [`${SEASON}/userA`]: [
    { type: 'dir', name: '1', path: `disk:/${SEASON}/userA/1` },
    { type: 'dir', name: '2', path: `disk:/${SEASON}/userA/2` },
  ],
  [`${SEASON}/userA/1`]: [
    { type: 'file', name: 'trackA1.mp3', path: `disk:/${SEASON}/userA/1/trackA1.mp3`, isAudio: true },
  ],
  [`${SEASON}/userA/2`]: [
    { type: 'file', name: 'trackA2.mp3', path: `disk:/${SEASON}/userA/2/trackA2.mp3`, isAudio: true },
  ],
  [`${SEASON}/userB`]: [{ type: 'dir', name: '1', path: `disk:/${SEASON}/userB/1` }],
  [`${SEASON}/userB/1`]: [
    { type: 'file', name: 'trackB1.mp3', path: `disk:/${SEASON}/userB/1/trackB1.mp3`, isAudio: true },
  ],
};

test.describe('Logii: play-all автора', () => {
  test.beforeEach(async ({ page }) => {
    await mockLogii(page, { diskTree: TREE });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    await expect
      .poll(
        async () => {
          return page.evaluate(() => {
            const fn = (window as unknown as { __library?: () => unknown }).__library;
            if (!fn) return 0;
            const lib = fn() as { tracks: Record<string, unknown> };
            return Object.keys(lib.tracks).length;
          });
        },
        { timeout: 10000 },
      )
      .toBe(3);
  });

  test('play у автора A → очередь = все треки A', async ({ page }) => {
    await page.getByTestId('author-play-userA').click();
    await expect
      .poll(async () => (await readPlayerQueue(page))?.map((t) => t.title).sort(), { timeout: 5000 })
      .toEqual(['trackA1', 'trackA2']);
  });

  test('повторный play у A → пауза', async ({ page }) => {
    await page.getByTestId('author-play-userA').click();
    await expect.poll(async () => readIsPlaying(page), { timeout: 5000 }).toBe(true);

    await page.getByTestId('author-play-userA').click();
    await expect.poll(async () => readIsPlaying(page), { timeout: 5000 }).toBe(false);
  });

  test('play у другого автора обновляет очередь', async ({ page }) => {
    await page.getByTestId('author-play-userA').click();
    await expect
      .poll(async () => (await readPlayerQueue(page))?.map((t) => t.title).sort(), { timeout: 5000 })
      .toEqual(['trackA1', 'trackA2']);

    await page.getByTestId('author-play-userB').click();
    await expect
      .poll(async () => (await readPlayerQueue(page))?.map((t) => t.title).sort(), { timeout: 5000 })
      .toEqual(['trackB1']);
  });

  test('play у A во время паузы → очередь пересоздаётся и играет', async ({ page }) => {
    await page.getByTestId('author-play-userA').click();
    await expect.poll(async () => readIsPlaying(page), { timeout: 5000 }).toBe(true);
    await page.getByTestId('author-play-userA').click();
    await expect.poll(async () => readIsPlaying(page), { timeout: 5000 }).toBe(false);

    await page.getByTestId('author-play-userA').click();
    await expect.poll(async () => readIsPlaying(page), { timeout: 5000 }).toBe(true);
    await expect
      .poll(async () => (await readPlayerQueue(page))?.map((t) => t.title).sort(), { timeout: 5000 })
      .toEqual(['trackA1', 'trackA2']);
  });
});

test.describe('Logii: автор без треков', () => {
  test('play-кнопка disabled', async ({ page }) => {
    const treeEmpty: Record<string, DiskItem[]> = {
      '': [{ type: 'dir', name: SEASON, path: `disk:/${SEASON}` }],
      [SEASON]: [{ type: 'dir', name: 'userEmpty', path: `disk:/${SEASON}/userEmpty` }],
      [`${SEASON}/userEmpty`]: [],
    };
    await mockLogii(page, { diskTree: treeEmpty });
    await bootstrapLogii(page);
    await openLogiiSeason(page, '2024-11-08');

    await expect(page.getByTestId('author-play-userEmpty')).toHaveAttribute('aria-disabled', 'true');
  });
});
