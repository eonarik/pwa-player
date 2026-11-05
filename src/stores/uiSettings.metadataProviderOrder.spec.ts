import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiSettingsStore } from './uiSettings';

const mockPlugins: Array<{ id: string; name: string; metadataPriority?: number }> = [];

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => mockPlugins,
}));

const UI_SETTINGS_KEY = 'player:uiSettings';
const LEGACY_KEY = 'zvuk:fetchMetadata';

describe('uiSettings: metadataProviderOrder', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPlugins.length = 0;
  });

  it('default: built-in + плагины с metadataPriority', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    mockPlugins.push({ id: 'other', name: 'Other', metadataPriority: 10 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'other', 'zvuk']);
  });

  it('default без плагинов: только built-in', () => {
    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer']);
  });

  it('миграция legacy "false": только built-in, ключ удалён', () => {
    localStorage.setItem(LEGACY_KEY, 'false');
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer']);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('миграция legacy "true": default с плагинами', () => {
    localStorage.setItem(LEGACY_KEY, 'true');
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('toggle off удаляет, toggle on вставляет по приоритету', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    mockPlugins.push({ id: 'other', name: 'Other', metadataPriority: 10 });

    const ui = useUiSettingsStore();
    ui.load(); // ['itunes', 'deezer', 'other', 'zvuk']

    ui.toggleMetadataProvider('zvuk', false);
    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'other']);

    ui.toggleMetadataProvider('zvuk', true);
    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'other', 'zvuk']);

    ui.toggleMetadataProvider('other', false);
    ui.toggleMetadataProvider('other', true);
    // 'other' priority 10 — между deezer (1) и zvuk (30)
    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'other', 'zvuk']);
  });

  it('пустой массив сохраняется (все выключены)', () => {
    const ui = useUiSettingsStore();
    ui.load();
    ui.setMetadataProviderOrder([]);
    ui.flush();

    const saved = JSON.parse(localStorage.getItem(UI_SETTINGS_KEY)!);
    expect(saved.metadataProviderOrder).toEqual([]);
  });

  it('persist/restore', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    const ui1 = useUiSettingsStore();
    ui1.load();
    ui1.setMetadataProviderOrder(['deezer', 'itunes', 'zvuk']);
    ui1.flush();

    // Новая сессия
    setActivePinia(createPinia());
    const ui2 = useUiSettingsStore();
    ui2.load();
    expect(ui2.metadataProviderOrder).toEqual(['deezer', 'itunes', 'zvuk']);
  });

  it('битый порядок (не массив) → default', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ metadataProviderOrder: 'invalid' }));

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
  });
});
