// e2e/mocks/api/radio.ts

import { Page } from '@playwright/test';
import fs from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const trackBuffer = fs.readFileSync(path.resolve(__dirname, '../../fixtures/mp3_15s_sample_file_236KB.mp3'));

export async function mockRadio(page: Page) {
  page.on('request', (req) => {
    if (req.url().includes('/json/')) {
      console.log('[MOCK RADIO] Request:', req.url());
    }
  });

  await page.route('**/json/countries', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'Russia', iso_3166_1: 'RU', stationcount: 100 }]),
    }),
  );

  await page.route('**/json/tags*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'pop', stationcount: 50 }]),
    }),
  );

  await page.route('**/json/stations/search*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          changeuuid: 'change-test-1',
          stationuuid: 'test-radio-1',
          serveruuid: 'server-1',
          name: 'Test Radio Station',
          url: '/test-stream.mp3',
          url_resolved: '/test-stream.mp3',
          homepage: 'https://example.com',
          favicon: 'https://example.com/favicon.png',
          tags: 'pop, rock',
          country: 'Russia',
          countrycode: 'RU',
          iso_3166_2: '',
          state: '',
          language: 'russian',
          languagecodes: 'ru',
          votes: 100,
          lastchangetime: '2023-01-01 00:00:00',
          lastchangetime_iso8601: '2023-01-01T00:00:00Z',
          codec: 'MP3',
          bitrate: 128,
          hls: 0,
          lastcheckok: 1,
          lastchecktime: '2023-01-01 00:00:00',
          lastchecktime_iso8601: '2023-01-01T00:00:00Z',
          lastcheckoktime: '2023-01-01 00:00:00',
          lastcheckoktime_iso8601: '2023-01-01T00:00:00Z',
          lastlocalchecktime: '',
          lastlocalchecktime_iso8601: '',
          clicktimestamp: '2023-01-01 00:00:00',
          clicktimestamp_iso8601: '2023-01-01T00:00:00Z',
          clickcount: 50,
          clicktrend: 10,
          ssl_error: 0,
          geo_lat: null,
          geo_long: null,
          has_extended_info: false,
        },
      ]),
    }),
  );

  await page.route('**/test-stream.mp3', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: trackBuffer,
    }),
  );

  await page.route('**/api/hls-proxy*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST',
    }),
  );
}
