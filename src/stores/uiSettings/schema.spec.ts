// src/stores/uiSettings/schema.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_METADATA_THRESHOLD,
  DEFAULT_PLAYLIST_MATCH_THRESHOLD,
  UI_SETTINGS_KEY,
  defaultProviderOrder,
  defaultValues,
  isValidThreshold,
  readFromStorage,
  sanitizeEnabled,
  sanitizeProviderOrder,
  writeToStorage,
  type PersistedUiSettings,
} from './schema';

const mockPlugins: Array<{ id: string; name: string; metadataPriority?: number }> = [];

/** Управляет броском реестра, чтобы проверить fallback только на built-in. */
let registryThrows = false;

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => {
    if (registryThrows) {
      throw new Error('registry unavailable');
    }
    return mockPlugins;
  },
}));

const LEGACY_KEY = 'zvuk:fetchMetadata';

function seed(partial: Record<string, unknown>): void {
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(partial));
}

beforeEach(() => {
  localStorage.clear();
  mockPlugins.length = 0;
});

describe('isValidThreshold', () => {
  it('принимает числа из [0, 1] включительно', () => {
    expect(isValidThreshold(0)).toBe(true);
    expect(isValidThreshold(0.75)).toBe(true);
    expect(isValidThreshold(1)).toBe(true);
  });

  it('отвергает выход за диапазон, NaN, Infinity и не-числа', () => {
    expect(isValidThreshold(-0.01)).toBe(false);
    expect(isValidThreshold(1.01)).toBe(false);
    expect(isValidThreshold(Number.NaN)).toBe(false);
    expect(isValidThreshold(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidThreshold('0.75')).toBe(false);
    expect(isValidThreshold(undefined)).toBe(false);
    expect(isValidThreshold(null)).toBe(false);
  });
});

describe('sanitizeProviderOrder', () => {
  it('не-массив даёт null', () => {
    expect(sanitizeProviderOrder('invalid')).toBeNull();
    expect(sanitizeProviderOrder({ a: 1 })).toBeNull();
    expect(sanitizeProviderOrder(undefined)).toBeNull();
  });

  it('выбрасывает не-строки и дубликаты, порядок сохраняет', () => {
    expect(sanitizeProviderOrder(['zvuk', 42, 'deezer', 'zvuk', null, 'itunes'])).toEqual([
      'zvuk',
      'deezer',
      'itunes',
    ]);
  });

  it('пустой массив — валидное значение (не null)', () => {
    expect(sanitizeProviderOrder([])).toEqual([]);
  });
});

describe('sanitizeEnabled', () => {
  it('не-объект и массив дают null', () => {
    expect(sanitizeEnabled(null)).toBeNull();
    expect(sanitizeEnabled('false')).toBeNull();
    expect(sanitizeEnabled(['zvuk'])).toBeNull();
  });

  it('оставляет только булевы значения', () => {
    expect(sanitizeEnabled({ zvuk: false, itunes: 'yes', deezer: 1, radio: true })).toEqual({
      zvuk: false,
      radio: true,
    });
  });
});

describe('defaultProviderOrder', () => {
  it('built-in первыми, плагины по возрастанию metadataPriority', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    mockPlugins.push({ id: 'logii', name: 'Logii', metadataPriority: 5 });
    mockPlugins.push({ id: 'radio', name: 'Радио' }); // без priority — не провайдер

    expect(defaultProviderOrder()).toEqual(['itunes', 'deezer', 'logii', 'zvuk']);
  });

  it('id из реестра не дублирует built-in', () => {
    mockPlugins.push({ id: 'itunes', name: 'Кривой плагин с id built-in', metadataPriority: 1 });

    expect(defaultProviderOrder()).toEqual(['itunes', 'deezer']);
  });

  it('исключение реестра не роняет — только built-in', () => {
    const previous = registryThrows;
    registryThrows = true;
    try {
      expect(defaultProviderOrder()).toEqual(['itunes', 'deezer']);
    } finally {
      registryThrows = previous;
    }
  });
});

describe('defaultValues', () => {
  it('дефолты: автопоиск включён, автозагрузка и показ источников выключены', () => {
    const values = defaultValues();

    expect(values.autoFetchMetadata).toBe(true);
    expect(values.autoDownloadTracks).toBe(false);
    expect(values.showSource).toBe(false);
    expect(values.showFiles).toBe(false);
    expect(values.metadataThreshold).toBe(DEFAULT_METADATA_THRESHOLD);
    expect(values.metadataProviderEnabled).toEqual({});
  });
});

describe('readFromStorage: миграция порядка провайдеров', () => {
  it('дописывает недостающие провайдеры в конец (старый формат хранил только включённые)', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    seed({ metadataProviderOrder: ['deezer', 'zvuk'] });

    const result = readFromStorage();

    expect(result?.metadataProviderOrder).toEqual(['deezer', 'zvuk', 'itunes']);
  });

  it('сохранённый порядок не перемешивает и не дублирует', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    seed({ metadataProviderOrder: ['zvuk', 'deezer', 'itunes'] });

    expect(readFromStorage()?.metadataProviderOrder).toEqual(['zvuk', 'deezer', 'itunes']);
  });

  it('битый порядок заменяется дефолтным', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    seed({ metadataProviderOrder: 'не массив' });

    expect(readFromStorage()?.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
  });
});

describe('readFromStorage: пороги и флаги', () => {
  it('битый порог заменяется дефолтным, валидный сохраняется', () => {
    seed({ metadataThreshold: 1.5, searchThreshold: 0.4, playlistMatchThreshold: 'x' });

    const result = readFromStorage();

    expect(result?.metadataThreshold).toBe(DEFAULT_METADATA_THRESHOLD);
    expect(result?.searchThreshold).toBe(0.4);
    expect(result?.playlistMatchThreshold).toBe(DEFAULT_PLAYLIST_MATCH_THRESHOLD);
  });

  it('частичная запись дополняется дефолтами', () => {
    seed({ showSource: true });

    const result = readFromStorage();

    expect(result?.showSource).toBe(true);
    expect(result?.showFiles).toBe(false);
    expect(result?.autoFetchMetadata).toBe(true);
    expect(result?.autoDownloadTracks).toBe(false);
  });

  it('битый JSON даёт null', () => {
    localStorage.setItem(UI_SETTINGS_KEY, '{битый');

    expect(readFromStorage()).toBeNull();
  });

  it('отсутствие записи даёт дефолты', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    expect(readFromStorage()?.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
  });
});

describe('readFromStorage: legacy-ключ Zvuk', () => {
  it('"false" выключает все провайдеры и удаляет legacy-ключ', () => {
    localStorage.setItem(LEGACY_KEY, 'false');
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const result = readFromStorage();

    expect(result?.metadataProviderEnabled).toEqual({ itunes: false, deezer: false, zvuk: false });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('"true" оставляет все включёнными', () => {
    localStorage.setItem(LEGACY_KEY, 'true');

    expect(readFromStorage()?.metadataProviderEnabled).toEqual({});
  });

  it('сохранённый enabled сильнее legacy-ключа', () => {
    localStorage.setItem(LEGACY_KEY, 'false');
    seed({ metadataProviderEnabled: { zvuk: false } });

    expect(readFromStorage()?.metadataProviderEnabled).toEqual({ zvuk: false });
  });

  it('идемпотентно: второй вызов не применяет legacy повторно', () => {
    localStorage.setItem(LEGACY_KEY, 'false');

    expect(readFromStorage()?.metadataProviderEnabled).toEqual({ itunes: false, deezer: false });

    localStorage.removeItem(UI_SETTINGS_KEY);
    expect(readFromStorage()?.metadataProviderEnabled).toEqual({});
  });
});

describe('writeToStorage', () => {
  it('пишет и читает без потерь', () => {
    const data: PersistedUiSettings = {
      ...defaultValues(),
      showSource: true,
      metadataProviderOrder: ['deezer', 'itunes'],
      metadataProviderEnabled: { itunes: false },
    };

    writeToStorage(data);

    expect(readFromStorage()).toEqual(data);
  });

  it('ошибка записи не бросает (приватный режим, переполнение)', () => {
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    expect(() => writeToStorage(defaultValues())).not.toThrow();

    localStorage.setItem = original;
  });
});
