// server/src/disk/filter.spec.js

import { describe, it, expect } from 'vitest'
import { filterPublicItems } from './filter.js'

function item(path) {
  return { path, name: path.split('/').pop() ?? path, type: 'dir' }
}

describe('filterPublicItems', () => {
  it('пустой список публичных папок → пустой результат', () => {
    const items = [item('/a'), item('/b')]
    expect(filterPublicItems(items, '/', [])).toEqual([])
  })

  it('publicFolders содержит / → всё публично', () => {
    const items = [item('/a'), item('/b')]
    expect(filterPublicItems(items, '/', ['/'])).toEqual(items)
  })

  it('publicFolders содержит "" → всё публично', () => {
    const items = [item('/a'), item('/b')]
    expect(filterPublicItems(items, '/', [''])).toEqual(items)
  })

  it('оставляет саму публичную папку', () => {
    const items = [item('/nostalgy'), item('/other')]
    const result = filterPublicItems(items, '/', ['/nostalgy'])
    expect(result.map((i) => i.path)).toEqual(['/nostalgy'])
  })

  it('оставляет содержимое публичной папки', () => {
    const items = [item('/nostalgy/2020'), item('/other')]
    const result = filterPublicItems(items, '/nostalgy', ['/nostalgy'])
    expect(result.map((i) => i.path)).toEqual(['/nostalgy/2020'])
  })

  it('оставляет родителя публичной папки (для навигации)', () => {
    const items = [item('/nostalgy'), item('/other')]
    const result = filterPublicItems(items, '/', ['/nostalgy/2020'])
    expect(result.map((i) => i.path)).toEqual(['/nostalgy'])
  })

  it('несколько публичных папок', () => {
    const items = [item('/a'), item('/b'), item('/c')]
    const result = filterPublicItems(items, '/', ['/a', '/b'])
    expect(result.map((i) => i.path).sort()).toEqual(['/a', '/b'])
  })

  it('нормализует пути элементов', () => {
    const items = [item('/nostalgy/')]
    const result = filterPublicItems(items, '/', ['/nostalgy'])
    expect(result).toHaveLength(1)
  })

  it('элемент вне публичной зоны → отфильтрован', () => {
    const items = [item('/secret'), item('/nostalgy')]
    const result = filterPublicItems(items, '/', ['/nostalgy'])
    expect(result.map((i) => i.path)).toEqual(['/nostalgy'])
  })
})
