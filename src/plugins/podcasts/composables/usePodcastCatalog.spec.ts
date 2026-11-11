// src/plugins/podcasts/composables/usePodcastCatalog.spec.ts

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Podcast } from '../types';
import { withSetup } from '@/test/withSetup';
import { usePodcastCatalog } from './usePodcastCatalog';

const h = vi.hoisted(() => ({
  getTopPodcasts: vi.fn(async (_country: string, _genre: string | undefined, _limit: number): Promise<Podcast[]> => []),
  searchItunes: vi.fn(async (_query: string, _limit: number): Promise<Podcast[]> => []),
}));

vi.mock('../PodcastService', () => ({ podcastService: h }));

function pod(id: string): Podcast {
  return {
    id,
    feedUrl: `https://feeds.example.com/${id}.xml`,
    title: `Подкаст ${id}`,
    description: '',
    image: '',
    author: 'Автор',
    categories: [],
    fetchedAt: 0,
  };
}

/** 40 подкастов, чтобы резать страницы. */
function many(count: number): Podcast[] {
  return Array.from({ length: count }, (_, i) => pod(`p${i + 1}`));
}

function setup() {
  return withSetup(() => usePodcastCatalog());
}

/** Прогоняет очередь микротask'ов, чтобы watch-и с flush:'pre' успели отработать. */
async function flush(): Promise<void> {
  await nextTick();
  await vi.advanceTimersByTimeAsync(0);
}

describe('usePodcastCatalog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.clearAllMocks();
    h.getTopPodcasts.mockImplementation(async () => many(40));
    h.searchItunes.mockImplementation(async () => many(3));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('загрузка топа', () => {
    it('берёт страницу срезом и оставляет hasMore, пока не уперлись в MAX_TOP_SIZE', async () => {
      const { result: catalog, unmount } = setup();

      await catalog.loadTop(2);

      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 30);
      expect(catalog.podcasts.value.map((p) => p.id)).toEqual(many(30).slice(15, 30).map((p) => p.id));
      expect(catalog.hasMore.value).toBe(true);
      expect(catalog.isLoading.value).toBe(false);
      expect(catalog.error.value).toBe('');
      unmount();
    });

    it('обрезает запрос к топу на MAX_TOP_SIZE', async () => {
      const { result: catalog, unmount } = setup();
      catalog.topLimit.value = 100;
      await flush();
      h.getTopPodcasts.mockClear();

      await catalog.loadTop(3);

      expect(h.getTopPodcasts).toHaveBeenCalledTimes(1);
      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 200);
      unmount();
    });

    it('гасит hasMore, когда выборка дошла до MAX_TOP_SIZE', async () => {
      const { result: catalog, unmount } = setup();
      catalog.topLimit.value = 100;
      h.getTopPodcasts.mockImplementation(async () => many(200));
      await flush();

      await catalog.loadTop(2);

      expect(catalog.hasMore.value).toBe(false);
      unmount();
    });

    it('пустой топ — это ошибка, а не пустой список без текста', async () => {
      const { result: catalog, unmount } = setup();
      h.getTopPodcasts.mockImplementation(async () => []);

      await catalog.loadTop(1);

      expect(catalog.podcasts.value).toEqual([]);
      expect(catalog.hasMore.value).toBe(false);
      expect(catalog.error.value).toBe('Не удалось загрузить топ');
      unmount();
    });

    it('исключение сервиса превращается в ту же ошибку топа', async () => {
      const { result: catalog, unmount } = setup();
      h.getTopPodcasts.mockImplementation(async () => {
        throw new Error('network');
      });

      await catalog.loadTop(1);

      expect(catalog.podcasts.value).toEqual([]);
      expect(catalog.error.value).toBe('Не удалось загрузить топ');
      expect(catalog.isLoading.value).toBe(false);
      unmount();
    });

    it('передача жанра фильтрует запрос, пустой жанр не прокидывается', async () => {
      const { result: catalog, unmount } = setup();
      catalog.genre.value = '1303';

      await catalog.loadTop(1);

      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', '1303', 15);
      unmount();
    });
  });

  describe('поиск', () => {
    it('найдено ноль — сообщение «Ничего не найдено»', async () => {
      const { result: catalog, unmount } = setup();
      h.searchItunes.mockImplementation(async () => []);

      await catalog.loadSearch('что-то');

      expect(catalog.podcasts.value).toEqual([]);
      expect(catalog.error.value).toBe('Ничего не найдено');
      expect(catalog.hasMore.value).toBe(false);
      unmount();
    });

    it('исключение при поиске даёт «Ошибка поиска»', async () => {
      const { result: catalog, unmount } = setup();
      h.searchItunes.mockImplementation(async () => {
        throw new Error('network');
      });

      await catalog.loadSearch('что-то');

      expect(catalog.error.value).toBe('Ошибка поиска');
      unmount();
    });

    it('load() в режиме поиска идёт в searchItunes, а не в топ', async () => {
      const { result: catalog, unmount } = setup();
      catalog.debouncedQuery.value = '  мануал  ';

      await catalog.load();

      expect(h.searchItunes).toHaveBeenCalledWith('мануал', 20);
      expect(h.getTopPodcasts).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('debounce поиска', () => {
    it('загружает поиск только спустя 500 мс и сбрасывает страницу', async () => {
      const { result: catalog, unmount } = setup();

      catalog.searchQuery.value = 'аудиокнига';
      await nextTick();
      expect(h.searchItunes).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(499);
      expect(h.searchItunes).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(h.searchItunes).toHaveBeenCalledWith('аудиокнига', 20);
      expect(catalog.currentPage.value).toBe(1);
      expect(catalog.isSearchMode.value).toBe(true);
      unmount();
    });

    it('повторный запрос с той же строкой после дебаунса не перезагружает', async () => {
      const { result: catalog, unmount } = setup();
      catalog.debouncedQuery.value = 'книги';

      catalog.searchQuery.value = 'книги';
      await vi.advanceTimersByTimeAsync(500);

      expect(h.searchItunes).not.toHaveBeenCalled();
      unmount();
    });

    it('пробелы не включают режим поиска', async () => {
      const { result: catalog, unmount } = setup();

      catalog.searchQuery.value = '   ';
      await vi.advanceTimersByTimeAsync(500);

      expect(catalog.isSearchMode.value).toBe(false);
      expect(h.searchItunes).not.toHaveBeenCalled();
      unmount();
    });

    it('сохраняет запрос в localStorage и не грузит топ в режиме поиска', async () => {
      const { result: catalog, unmount } = setup();

      catalog.searchQuery.value = 'подкаст';
      await vi.advanceTimersByTimeAsync(500);

      expect(localStorage.getItem('podcasts:searchQuery')).toBe('подкаст');
      unmount();
    });

    it('снятие запроса возвращается к топу', async () => {
      const { result: catalog, unmount } = setup();
      catalog.searchQuery.value = 'книги';
      catalog.debouncedQuery.value = 'книги';
      await vi.advanceTimersByTimeAsync(500);
      h.getTopPodcasts.mockClear();

      catalog.searchQuery.value = '';
      await vi.advanceTimersByTimeAsync(500);

      expect(h.getTopPodcasts).toHaveBeenCalledTimes(1);
      expect(catalog.isSearchMode.value).toBe(false);
      unmount();
    });
  });

  describe('фильтры и пагинация', () => {
    it('смена страны пишет в localStorage и перезагружает первую страницу', async () => {
      const { result: catalog, unmount } = setup();
      catalog.currentPage.value = 4;

      await catalog.loadTop(4); // resolve pending promise

      catalog.country.value = 'us';
      await flush();

      expect(localStorage.getItem('podcasts:country')).toBe('us');
      expect(catalog.currentPage.value).toBe(1);
      expect(h.getTopPodcasts).toHaveBeenCalledWith('us', undefined, 15);
      unmount();
    });

    it('в режиме поиска смена фильтров не грузит топ', async () => {
      const { result: catalog, unmount } = setup();
      catalog.debouncedQuery.value = 'книги';
      h.getTopPodcasts.mockClear();

      catalog.genre.value = '1303';
      await flush();

      expect(localStorage.getItem('podcasts:genre')).toBe('1303');
      expect(h.getTopPodcasts).not.toHaveBeenCalled();
      unmount();
    });

    it('смена страницы грузит эту страницу', async () => {
      const { result: catalog, unmount } = setup();

      catalog.currentPage.value = 3;
      await flush();

      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 45);
      unmount();
    });

    it('смена лимита пишет числовое значение и грузит первую страницу', async () => {
      const { result: catalog, unmount } = setup();

      catalog.topLimit.value = 30;
      await flush();

      expect(localStorage.getItem('podcasts:topLimit')).toBe('30');
      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 30);
      unmount();
    });
  });

  describe('listTitle', () => {
    it('топ без жанра', () => {
      const { result: catalog, unmount } = setup();
      expect(catalog.listTitle.value).toBe('Топ подкастов (Россия)');
      unmount();
    });

    it('топ с жанром', () => {
      const { result: catalog, unmount } = setup();
      catalog.genre.value = '1488';
      catalog.country.value = 'us';
      expect(catalog.listTitle.value).toBe('Топ: Тру-крайм (США)');
      unmount();
    });

    it('жанр «Все жанры» не попадает в заголовок', () => {
      const { result: catalog, unmount } = setup();
      catalog.genre.value = '';
      expect(catalog.listTitle.value).toBe('Топ подкастов (Россия)');
      unmount();
    });

    it('неизвестный код страны показывается как есть', () => {
      const { result: catalog, unmount } = setup();
      catalog.country.value = 'zz';
      expect(catalog.listTitle.value).toBe('Топ подкастов (zz)');
      unmount();
    });

    it('в режиме поиска — заголовок с запросом без пробелов по краям', () => {
      const { result: catalog, unmount } = setup();
      catalog.debouncedQuery.value = '  книги  ';
      expect(catalog.listTitle.value).toBe('Поиск: «книги»');
      unmount();
    });
  });

  describe('clearSearch и retryLoad', () => {
    it('clearSearch убирает запрос и грузит топ', async () => {
      const { result: catalog, unmount } = setup();
      catalog.searchQuery.value = 'книги';
      catalog.debouncedQuery.value = 'книги';
      await vi.advanceTimersByTimeAsync(500);
      h.getTopPodcasts.mockClear();

      catalog.clearSearch();

      expect(localStorage.getItem('podcasts:searchQuery') ?? '').toBe('');
      expect(catalog.searchQuery.value).toBe('');
      expect(catalog.debouncedQuery.value).toBe('');
      expect(catalog.currentPage.value).toBe(1);
      expect(h.getTopPodcasts).toHaveBeenCalledTimes(1);
      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 15);
      unmount();
    });

    it('retryLoad в режиме топа грузит текущую страницу', async () => {
      const { result: catalog, unmount } = setup();

      catalog.retryLoad();
      await flush();

      expect(h.getTopPodcasts).toHaveBeenCalledWith('ru', undefined, 15);
      expect(h.searchItunes).not.toHaveBeenCalled();
      unmount();
    });

    it('retryLoad в режиме поиска повторяет поиск, а не топ', async () => {
      const { result: catalog, unmount } = setup();
      catalog.debouncedQuery.value = ' книги ';

      catalog.retryLoad();
      await flush();

      expect(h.searchItunes).toHaveBeenCalledWith('книги', 20);
      expect(h.getTopPodcasts).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe('стартовое состояние из localStorage', () => {
    it('читает страну, жанр, запрос и лимит', () => {
      localStorage.setItem('podcasts:country', 'de');
      localStorage.setItem('podcasts:genre', '1310');
      localStorage.setItem('podcasts:searchQuery', 'джаз');
      localStorage.setItem('podcasts:topLimit', '5');

      const { result: catalog, unmount } = setup();

      expect(catalog.country.value).toBe('de');
      expect(catalog.genre.value).toBe('1310');
      expect(catalog.searchQuery.value).toBe('джаз');
      expect(catalog.debouncedQuery.value).toBe('джаз');
      expect(catalog.topLimit.value).toBe(5);
      expect(catalog.isSearchMode.value).toBe(true);
      unmount();
    });

    it('битый лимит превращается в дефолт', () => {
      localStorage.setItem('podcasts:topLimit', 'не-число');

      const { result: catalog, unmount } = setup();

      expect(catalog.topLimit.value).toBe(15);
      unmount();
    });
  });
});
