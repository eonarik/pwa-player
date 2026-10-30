// src/plugins/extensions.spec.ts

// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadExtensions,
  getAllSettingsSchemas,
  getExtensionRoutes,
  getExtensionMenuItems,
  clearExtensions,
} from './extensions';
import type { PluginManifest } from './types';

const plugins: PluginManifest[] = [];

vi.mock('./registry', () => ({
  getPlugins: () => plugins,
}));

vi.mock('./remoteLoader', () => ({
  loadRemotePlugins: async () => [],
}));

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test',
    name: 'Test',
    icon: '',
    version: '1',
    enabled: true,
    canDownload: false,
    entry: vi.fn(),
    ...overrides,
  } as PluginManifest;
}

const schema = { sections: [{ id: 's1', fields: [] }] };

describe('extensions', () => {
  beforeEach(() => {
    plugins.length = 0;
    clearExtensions();
  });

  it('manifest.getSettings без extension → попадает в настройки', async () => {
    plugins.push(
      makeManifest({
        id: 'yandex-self',
        getSettings: async () => schema,
      }),
    );

    await loadExtensions();

    const settings = getAllSettingsSchemas();
    expect(settings).toHaveLength(1);
    expect(settings[0]!.manifest.id).toBe('yandex-self');
    expect(settings[0]!.schema).toEqual(schema);
  });

  it('extension.getSettings → попадает в настройки', async () => {
    plugins.push(
      makeManifest({
        id: 'with-ext',
        extension: async () => ({
          default: { getSettings: async () => schema },
        }),
      }),
    );

    await loadExtensions();

    const settings = getAllSettingsSchemas();
    expect(settings).toHaveLength(1);
    expect(settings[0]!.manifest.id).toBe('with-ext');
  });

  it('extension.getSettings приоритетнее manifest.getSettings', async () => {
    const manifestSchema = { sections: [{ id: 'm', fields: [] }] };
    const extSchema = { sections: [{ id: 'e', fields: [] }] };

    plugins.push(
      makeManifest({
        id: 'both',
        getSettings: async () => manifestSchema,
        extension: async () => ({
          default: { getSettings: async () => extSchema },
        }),
      }),
    );

    await loadExtensions();

    const settings = getAllSettingsSchemas();
    expect(settings[0]!.schema).toEqual(extSchema);
  });

  it('extension с routes и menuItems', async () => {
    plugins.push(
      makeManifest({
        id: 'routed',
        extension: async () => ({
          default: {
            menuItems: [{ id: 'm', label: 'M', icon: '', routeName: 'm' }],
            routes: [{ path: '/m', name: 'm', component: {} as never }],
          },
        }),
      }),
    );

    await loadExtensions();

    expect(getExtensionMenuItems()).toHaveLength(1);
    expect(getExtensionRoutes()).toHaveLength(1);
    expect(getAllSettingsSchemas()).toHaveLength(0);
  });
});
