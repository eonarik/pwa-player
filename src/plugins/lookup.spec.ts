// src/plugins/lookup.spec.ts

// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi } from 'vitest';
import { getPluginManifest, getPluginName } from './lookup';
import type { PluginManifest } from './types';

vi.mock('./registry', () => {
  const plugins: PluginManifest[] = [
    {
      id: 'local',
      name: 'Локальная папка',
      icon: 'folder',
      version: '1',
      enabled: true,
      canDownload: false,
      entry: vi.fn(),
    },
    {
      id: 'yandex',
      name: 'Яндекс.Диск',
      icon: 'cloud',
      version: '1',
      enabled: true,
      canDownload: true,
      entry: vi.fn(),
    },
  ];

  return {
    getPlugins: () => plugins,
    pluginIdFromSource: (source: string) => {
      const colon = source.indexOf(':');
      return colon === -1 ? source : source.slice(0, colon);
    },
  };
});

describe('getPluginManifest', () => {
  it('находит по чистому id', () => {
    expect(getPluginManifest('local')?.name).toBe('Локальная папка');
    expect(getPluginManifest('yandex')?.name).toBe('Яндекс.Диск');
  });

  it('находит по source (local:Music)', () => {
    expect(getPluginManifest('local:Music')?.id).toBe('local');
  });

  it('возвращает null для неизвестного id', () => {
    expect(getPluginManifest('nope')).toBeNull();
  });

  it('возвращает null для пустой строки', () => {
    expect(getPluginManifest('')).toBeNull();
  });
});

describe('getPluginName', () => {
  it('возвращает имя по id', () => {
    expect(getPluginName('local')).toBe('Локальная папка');
  });

  it('возвращает имя по source', () => {
    expect(getPluginName('local:Music')).toBe('Локальная папка');
  });

  it('возвращает fallback для неизвестного id', () => {
    expect(getPluginName('nope')).toBe('<unknown_source>');
  });

  it('возвращает кастомный fallback', () => {
    expect(getPluginName('nope', '?')).toBe('?');
  });
});
