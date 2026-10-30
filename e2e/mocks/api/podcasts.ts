// e2e/mocks/api/podcasts.ts

import { Page } from '@playwright/test';

export async function mockPodcasts(page: Page) {
  // Мокаем iTunes Search API
  await page.route('**/api/podcasts/proxy?url=*itunes*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            collectionId: 12345,
            collectionName: 'Test Podcast',
            artistName: 'Test Author',
            artworkUrl600: 'https://example.com/podcast.jpg',
            feedUrl: 'https://example.com/feed.xml',
            genres: ['Technology'],
            trackCount: 10,
          },
        ],
      }),
    }),
  );

  // Мокаем RSS ленту
  await page.route('**/api/podcasts/proxy?url=*feed.xml*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <title>Test Podcast</title>
            <description>A test podcast</description>
            <itunes:image href="https://example.com/podcast.jpg"/>
            <item>
              <title>Episode 1</title>
              <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="1000"/>
              <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
              <itunes:duration>1800</itunes:duration>
            </item>
            <item>
              <title>Episode 2</title>
              <enclosure url="https://example.com/ep2.mp3" type="audio/mpeg" length="2000"/>
              <pubDate>Tue, 02 Jan 2024 12:00:00 GMT</pubDate>
              <itunes:duration>2400</itunes:duration>
            </item>
          </channel>
        </rss>`,
    }),
  );
}
