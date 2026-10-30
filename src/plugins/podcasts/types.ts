// src/plugins/podcasts/types.ts

export interface Podcast {
  /** id подкаста (из RSS или iTunes) */
  id: string;
  /** URL RSS-ленты — источник правды */
  feedUrl: string;
  title: string;
  description: string;
  image: string;
  author: string;
  /** Категории/теги, если есть */
  categories: string[];
  /** Когда последний раз обновляли ленту */
  fetchedAt: number;
  /**
   * true — сериальный подкаст (книги, аудиодрамы, true crime),
   * эпизоды идут по порядку. false/undefined — эпизодический,
   * новые сверху.
   */
  isSerial?: boolean;
}

export interface Episode {
  /** id эпизода (guid из RSS) */
  id: string;
  /** id подкаста, к которому относится */
  podcastId: string;
  title: string;
  description: string;
  /** URL MP3 */
  audioUrl: string;
  /** Размер в байтах, если указан */
  sizeBytes: number | null;
  /** Длительность в секундах, если указана */
  durationSec: number | null;
  /** Дата публикации (timestamp) */
  publishedAt: number;
  image: string;
}

export interface Subscription {
  podcast: Podcast;
  /** Последний известный список эпизодов */
  episodes: Episode[];
  /** Когда последний раз обновляли */
  updatedAt: number;
}

export interface PersistedSubscriptions {
  subscriptions: Subscription[];
  savedAt: number;
}
