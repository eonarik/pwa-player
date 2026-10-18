// server/src/settings/client.spec.js

import { describe, it, expect } from 'vitest'
import { isPathPublic, isSettingsPath } from './client.js'

describe('isPathPublic', () => {
  it('пустой список публичных папок → всё закрыто', () => {
    expect(isPathPublic('/', [])).toBe(false)
    expect(isPathPublic('/Music', [])).toBe(false)
  })

  it('publicFolders содержит / или "" → всё открыто', () => {
    expect(isPathPublic('/', ['/'])).toBe(true)
    expect(isPathPublic('/anything', ['/'])).toBe(true)
    expect(isPathPublic('/', [''])).toBe(true)
    expect(isPathPublic('/anything', [''])).toBe(true)
  })

  it('точное совпадение с публичной папкой', () => {
    expect(isPathPublic('/nostalgy', ['/nostalgy'])).toBe(true)
    expect(isPathPublic('/nostalgy/2020', ['/nostalgy/2020'])).toBe(true)
  })

  it('путь внутри публичной папки', () => {
    expect(isPathPublic('/nostalgy/2020', ['/nostalgy'])).toBe(true)
    expect(isPathPublic('/nostalgy/2020/track.mp3', ['/nostalgy'])).toBe(true)
  })

  it('путь — родитель публичной папки (нужен для навигации)', () => {
    expect(isPathPublic('/', ['/nostalgy/2020'])).toBe(true)
    expect(isPathPublic('/nostalgy', ['/nostalgy/2020'])).toBe(true)
  })

  it('путь вне публичной зоны → false', () => {
    expect(isPathPublic('/secret', ['/nostalgy'])).toBe(false)
    expect(isPathPublic('/nostalgy2', ['/nostalgy'])).toBe(false)
    expect(isPathPublic('/nostalgy-old', ['/nostalgy'])).toBe(false)
  })

  it('path traversal: атака через ..', () => {
    expect(isPathPublic('/nostalgy/../../../secret', ['/nostalgy'])).toBe(false)
    expect(isPathPublic('/nostalgy/../secret', ['/nostalgy'])).toBe(false)
  })

  it('несколько публичных папок', () => {
    expect(isPathPublic('/a/x', ['/a', '/b'])).toBe(true)
    expect(isPathPublic('/b/x', ['/a', '/b'])).toBe(true)
    expect(isPathPublic('/c/x', ['/a', '/b'])).toBe(false)
  })

  it('нормализует входной путь', () => {
    expect(isPathPublic('disk:/nostalgy', ['/nostalgy'])).toBe(true)
    expect(isPathPublic('///nostalgy///', ['/nostalgy'])).toBe(true)
  })

  it('нормализует путь в publicFolders', () => {
    expect(isPathPublic('/nostalgy', ['disk:/nostalgy'])).toBe(true)
    expect(isPathPublic('/nostalgy', ['///nostalgy///'])).toBe(true)
  })
})

describe('isSettingsPath', () => {
  it('распознаёт .settings.json в корне', () => {
    expect(isSettingsPath('.settings.json')).toBe(true)
    expect(isSettingsPath('/.settings.json')).toBe(true)
    expect(isSettingsPath('disk:/.settings.json')).toBe(true)
  })

  it('не путает с вложенными файлами', () => {
    expect(isSettingsPath('/Music/.settings.json')).toBe(false)
    expect(isSettingsPath('/foo.txt')).toBe(false)
  })

  it('с path traversal — нормализуется и не проходит', () => {
    // '/secret/../.settings.json' нормализуется в '.settings.json'
    expect(isSettingsPath('/secret/../.settings.json')).toBe(true)
    // Но '/.settings.json/..' схлопнется в '' — не подходит
    expect(isSettingsPath('/.settings.json/..')).toBe(false)
  })
})
