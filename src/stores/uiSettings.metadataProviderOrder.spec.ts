// src/stores/uiSettings.metadataProviderOrder.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiSettingsStore } from './uiSettings';

const mockPlugins: Array<{ id: string; name: string; metadataPriority?: number }> = [];

vi.mock('@/plugins/registry', () => ({
  getPlugins: () => mockPlugins,
}));

const UI_SETTINGS_KEY = 'player:uiSettings';
const LEGACY_KEY = 'zvuk:fetchMetadata';

describe('uiSettings: metadataProviderOrder + metadataProviderEnabled', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockPlugins.length = 0;
  });

  it('default: built-in + плагины с metadataPriority, все enabled = true', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    mockPlugins.push({ id: 'other', name: 'Other', metadataPriority: 10 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'other', 'zvuk']);
    expect(ui.metadataProviderEnabled).toEqual({});
  });

  it('default без плагинов: только built-in', () => {
    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer']);
    expect(ui.metadataProviderEnabled).toEqual({});
  });

  it('миграция legacy "false": все выключены', () => {
    localStorage.setItem(LEGACY_KEY, 'false');
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(ui.metadataProviderEnabled).toEqual({
      itunes: false,
      deezer: false,
      zvuk: false,
    });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('миграция legacy "true": все включены (enabled = {})', () => {
    localStorage.setItem(LEGACY_KEY, 'true');
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(ui.metadataProviderEnabled).toEqual({});
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('toggle off: не меняет порядок, ставит enabled = false', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load(); // ['itunes', 'deezer', 'zvuk']

    ui.toggleMetadataProvider('zvuk', false);

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(ui.metadataProviderEnabled.zvuk).toBe(false);
  });

  it('toggle on: убирает enabled = false', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();
    ui.toggleMetadataProvider('zvuk', false);
    ui.toggleMetadataProvider('zvuk', true);

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(ui.metadataProviderEnabled.zvuk).toBeUndefined();
  });

  it('setMetadataProviderOrder сохраняет порядок, enabled не трогает', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });

    const ui = useUiSettingsStore();
    ui.load();
    ui.toggleMetadataProvider('zvuk', false);

    ui.setMetadataProviderOrder(['zvuk', 'deezer', 'itunes']);

    expect(ui.metadataProviderOrder).toEqual(['zvuk', 'deezer', 'itunes']);
    expect(ui.metadataProviderEnabled.zvuk).toBe(false);
  });

  it('persist/restore', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    const ui1 = useUiSettingsStore();
    ui1.load();
    ui1.setMetadataProviderOrder(['deezer', 'itunes', 'zvuk']);
    ui1.toggleMetadataProvider('zvuk', false);
    ui1.flush();

    setActivePinia(createPinia());
    const ui2 = useUiSettingsStore();
    ui2.load();
    expect(ui2.metadataProviderOrder).toEqual(['deezer', 'itunes', 'zvuk']);
    expect(ui2.metadataProviderEnabled.zvuk).toBe(false);
  });

  it('битый порядок (не массив) → default', () => {
    mockPlugins.push({ id: 'zvuk', name: 'СберЗвук', metadataPriority: 30 });
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify({ metadataProviderOrder: 'invalid' }));

    const ui = useUiSettingsStore();
    ui.load();

    expect(ui.metadataProviderOrder).toEqual(['itunes', 'deezer', 'zvuk']);
    expect(ui.metadataProviderEnabled).toEqual({});
  });
});
