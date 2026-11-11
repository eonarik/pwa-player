// src/plugins/registry.spec.ts

import { beforeEach, describe, expect, it } from 'vitest';

import { activatePluginByCode, getPlugins, isPluginActivated, pluginIdFromSource } from './registry';

/**
 * Плагин, требующий активации, берётся из самого реестра:
 * тест не должен знать ни id «секретного» плагина, ни его код.
 */
function findActivatable() {
  return getPlugins().find((manifest) => manifest.requiresActivation === true);
}

function findOpenPlugin() {
  return getPlugins().find((manifest) => manifest.requiresActivation !== true);
}

describe('pluginIdFromSource', () => {
  it('отсекает часть идентификатора после ":"', () => {
    expect(pluginIdFromSource('demo:Music')).toBe('demo');
  });

  it('возвращает id без изменений, если ":" отсутствует', () => {
    expect(pluginIdFromSource('demo')).toBe('demo');
  });
});

describe('activatePluginByCode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('не активирует ничего при пустом коде', () => {
    expect(activatePluginByCode('   ')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('не активирует ничего при неверном коде', () => {
    const manifest = findActivatable();
    if (!manifest?.activationCode) throw new Error('в реестре нет плагина с requiresActivation');

    expect(activatePluginByCode(`${manifest.activationCode}-nope`)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('возвращает id плагина и запоминает флаг активации', () => {
    const manifest = findActivatable();
    if (!manifest?.activationCode) throw new Error('в реестре нет плагина с requiresActivation');

    expect(activatePluginByCode(manifest.activationCode)).toBe(manifest.id);
    expect(isPluginActivated(manifest.id)).toBe(true);
  });

  it('обрезает пробелы вокруг введённого кода', () => {
    const manifest = findActivatable();
    if (!manifest?.activationCode) throw new Error('в реестре нет плагина с requiresActivation');

    expect(activatePluginByCode(`  ${manifest.activationCode}  `)).toBe(manifest.id);
  });
});

describe('isPluginActivated', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('false для неизвестного id', () => {
    expect(isPluginActivated('no-such-plugin')).toBe(false);
  });

  it('true для плагина, которому активация не нужна', () => {
    const manifest = findOpenPlugin();
    if (!manifest) throw new Error('в реестре нет плагинов вообще');

    expect(isPluginActivated(manifest.id)).toBe(true);
  });
});
