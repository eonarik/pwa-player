// src/plugins/radio/browser/types.ts

/**
 * Публичные типы клиента Radio Browser.
 * Сырые ответы API (Raw*) скрыты в `api.ts` — наружу отдаются только эти.
 */

export type RadioSortOrder = 'clickCount' | 'votes' | 'clickTrend' | 'random' | 'bitrate' | 'name';

export interface RadioCountry {
  name: string;
  code: string;
  stationCount: number;
}

export interface RadioTag {
  name: string;
  stationCount: number;
}

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  favicon: string;
  tags: string[];
  country: string;
  bitrate: number;
}

export interface RadioStationSearchQuery {
  name?: string;
  limit?: number;
  offset?: number;
  order?: RadioSortOrder;
  reverse?: boolean;
  countryCode?: string;
  tagList?: string[];
  hideBroken?: boolean;
}
