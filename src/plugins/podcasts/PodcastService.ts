// src/plugins/podcasts/PodcastService.ts

import type { Episode, Podcast } from './types';

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_URL = 'https://itunes.apple.com/lookup';
const APPLE_CHARTS_URL = 'https://rss.applemarketingtools.com/api/v2';

const REQUEST_TIMEOUT_MS = 15_000;
const PROXY_PREFIX = '/api/podcasts/proxy';

export interface ItunesPodcast {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl600: string;
  feedUrl: string;
  genres: string[];
  trackCount: number;
}

interface AppleChartEntry {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100: string;
  url: string;
}

interface ParsedFeed {
  title: string;
  description: string;
  image: string;
  author: string;
  isSerial: boolean;
  episodes: Episode[];
}

export class PodcastService {
  private static instance: PodcastService | null = null;

  static getInstance(): PodcastService {
    if (!PodcastService.instance) {
      PodcastService.instance = new PodcastService();
    }
    return PodcastService.instance;
  }

  /**
   * Загружает и парсит RSS-ленту подкаста через прокси.
   */
  async fetchFeed(feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
    const res = await fetch(this.proxyRss(feedUrl), {
      headers: { Accept: 'application/xml, text/xml' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`RSS fetch failed: HTTP ${res.status}`);
    }

    const xmlText = await res.text();
    const parsed = this.parseRss(xmlText);

    const podcast: Podcast = {
      id: this.feedId(feedUrl),
      feedUrl,
      title: parsed.title,
      description: parsed.description,
      image: parsed.image,
      author: parsed.author,
      categories: [],
      fetchedAt: Date.now(),
      isSerial: parsed.isSerial,
    };

    return { podcast, episodes: parsed.episodes };
  }

  /**
   * Топ подкастов из Apple Charts (страна + жанр).
   * 1. Запрос чарта → список iTunes id.
   * 2. Lookup по id → feedUrl.
   */
  async getTopPodcasts(country = 'ru', genre?: string, limit = 20): Promise<Podcast[]> {
    const chartUrl = genre
      ? `${APPLE_CHARTS_URL}/${country}/podcasts/top/${limit}/podcasts.json?genre=${genre}`
      : `${APPLE_CHARTS_URL}/${country}/podcasts/top/${limit}/podcasts.json`;

    const chartRes = await fetch(this.proxyRss(chartUrl), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!chartRes.ok) return [];

    const chartData = (await chartRes.json()) as { feed?: { results?: AppleChartEntry[] } };
    const entries = chartData.feed?.results ?? [];
    if (entries.length === 0) return [];

    const ids = entries.map((e) => e.id).join(',');
    const lookupRes = await fetch(this.proxyRss(`${ITUNES_LOOKUP_URL}?id=${ids}&entity=podcast`), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!lookupRes.ok) return [];

    const lookupData = (await lookupRes.json()) as { results: ItunesPodcast[] };
    const byId = new Map(lookupData.results.map((r) => [String(r.collectionId), r]));

    return entries
      .map((entry) => {
        const r = byId.get(entry.id);
        if (!r?.feedUrl) return null;
        return this.itunesToPodcast(r);
      })
      .filter((p): p is Podcast => p !== null);
  }

  /**
   * Поиск подкастов через iTunes Search API (через прокси).
   */
  async searchItunes(query: string, limit = 20): Promise<Podcast[]> {
    const params = new URLSearchParams({
      term: query,
      entity: 'podcast',
      limit: String(limit),
      country: 'RU',
    });

    const res = await fetch(this.proxyRss(`${ITUNES_SEARCH_URL}?${params.toString()}`), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results: ItunesPodcast[] };
    if (!data.results) return [];

    return data.results.filter((r) => Boolean(r.feedUrl)).map((r) => this.itunesToPodcast(r));
  }

  /**
   * Парсит RSS/Atom в список эпизодов.
   *
   * Сортировка:
   * - `<itunes:type>serial</itunes:type>` — старые сверху (по возрастанию даты).
   * - иначе (episodic или тега нет) — новые сверху (по убыванию даты).
   */
  parseRss(xmlText: string): ParsedFeed {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const channel = doc.querySelector('channel') ?? doc.documentElement;

    const title = this.text(channel, 'title') || 'Без названия';
    const description = this.text(channel, 'description') || '';
    const author = this.text(channel, 'itunes\\:author') || this.text(channel, 'managingEditor') || '';

    const itunesType = this.text(channel, 'itunes\\:type').toLowerCase();
    const isSerial = itunesType === 'serial';

    const image =
      this.attr(doc.querySelector('image'), 'href') ||
      this.text(doc.querySelector('image'), 'url') ||
      this.text(doc, 'itunes\\:image') ||
      '';

    const items = Array.from(doc.querySelectorAll('item, entry'));
    const episodes: Episode[] = [];

    for (const item of items) {
      const enclosure = item.querySelector('enclosure');
      const audioUrl = this.attr(enclosure, 'url') ?? '';
      if (!audioUrl || !audioUrl.startsWith('http')) continue;

      const type = this.attr(enclosure, 'type') ?? '';
      if (type.startsWith('video/')) continue;

      const lengthRaw = this.attr(enclosure, 'length');
      const sizeBytes = lengthRaw ? Number(lengthRaw) || null : null;

      const durationRaw = this.text(item, 'itunes\\:duration') || this.text(item, 'duration') || '';
      const durationSec = this.parseDuration(durationRaw);

      const publishedRaw = this.text(item, 'pubDate') || this.text(item, 'published') || '';
      const publishedAt = publishedRaw ? Date.parse(publishedRaw) || Date.now() : Date.now();

      const itemImage =
        this.attr(item.querySelector('itunes\\:image'), 'href') ||
        this.text(item.querySelector('itunes\\:image'), 'url') ||
        '';

      episodes.push({
        id: this.text(item, 'guid') || audioUrl,
        podcastId: '',
        title: this.text(item, 'title') || 'Без названия',
        description: this.text(item, 'description') || this.text(item, 'itunes\\:summary') || '',
        audioUrl,
        sizeBytes,
        durationSec,
        publishedAt,
        image: itemImage || image,
      });
    }

    if (isSerial) {
      episodes.sort((a, b) => a.publishedAt - b.publishedAt);
    } else {
      episodes.sort((a, b) => b.publishedAt - a.publishedAt);
    }

    return { title, description, image, author, isSerial, episodes };
  }

  private itunesToPodcast(r: ItunesPodcast): Podcast {
    return {
      id: `itunes:${r.collectionId}`,
      feedUrl: r.feedUrl,
      title: r.collectionName,
      description: '',
      image: r.artworkUrl600 ?? '',
      author: r.artistName ?? '',
      categories: r.genres ?? [],
      fetchedAt: 0,
    };
  }

  private proxyRss(url: string): string {
    return `${PROXY_PREFIX}?url=${encodeURIComponent(url)}`;
  }

  private feedId(feedUrl: string): string {
    let hash = 0;
    for (let i = 0; i < feedUrl.length; i++) {
      hash = (hash << 5) - hash + feedUrl.charCodeAt(i);
      hash |= 0;
    }
    return `feed:${Math.abs(hash).toString(36)}`;
  }

  private text(parent: ParentNode | null, selector: string): string {
    if (!parent) return '';
    try {
      const el = parent.querySelector(selector);
      return el?.textContent?.trim() ?? '';
    } catch {
      return '';
    }
  }

  private attr(el: Element | null, name: string): string | null {
    if (!el) return null;
    const value = el.getAttribute(name);
    return value ? value.trim() : null;
  }

  private parseDuration(raw: string): number | null {
    if (!raw) return null;
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const parts = raw.split(':').map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    let seconds = 0;
    for (const p of parts) seconds = seconds * 60 + p;
    return seconds > 0 ? seconds : null;
  }
}

export const podcastService = PodcastService.getInstance();
