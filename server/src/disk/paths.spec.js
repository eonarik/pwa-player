// server/src/disk/paths.spec.js

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveDiskPath, toClientPath } from './paths.js'

const ORIGINAL_ROOT = process.env.YANDEX_MUSIC_PATH

beforeEach(() => {
  process.env.YANDEX_MUSIC_PATH = '/Music'
})

afterEach(() => {
  if (ORIGINAL_ROOT === undefined) delete process.env.YANDEX_MUSIC_PATH
  else process.env.YANDEX_MUSIC_PATH = ORIGINAL_ROOT
})

describe('resolveDiskPath', () => {
  it('корень', () => {
    expect(resolveDiskPath('/')).toBe('disk:/Music')
    expect(resolveDiskPath('')).toBe('disk:/Music')
  })

  it('вложенные пути', () => {
    expect(resolveDiskPath('/Rock')).toBe('disk:/Music/Rock')
    expect(resolveDiskPath('/Rock/2020')).toBe('disk:/Music/Rock/2020')
  })

  it('нормализует path traversal', () => {
    expect(resolveDiskPath('/Rock/../../../secret')).toBe('disk:/Music/secret')
    expect(resolveDiskPath('/../secret')).toBe('disk:/Music/secret')
  })

  it('убирает disk: префикс', () => {
    expect(resolveDiskPath('disk:/Rock')).toBe('disk:/Music/Rock')
  })

  it('работает с кириллицей', () => {
    expect(resolveDiskPath('/Логии/LoGii3026')).toBe('disk:/Music/Логии/LoGii3026')
  })
})

describe('toClientPath', () => {
  it('корень → /', () => {
    expect(toClientPath('disk:/Music')).toBe('/')
  })

  it('внутри корня → относительный путь', () => {
    expect(toClientPath('disk:/Music/Rock')).toBe('/Rock')
    expect(toClientPath('disk:/Music/Rock/2020')).toBe('/Rock/2020')
  })

  it('вне корня → возвращает как есть', () => {
    expect(toClientPath('disk:/Other')).toBe('disk:/Other')
    expect(toClientPath('disk:/Other/Path')).toBe('disk:/Other/Path')
  })
})

describe('getMusicRootPath через resolve/toClient', () => {
  it('YANDEX_MUSIC_PATH=/', () => {
    process.env.YANDEX_MUSIC_PATH = '/'
    expect(resolveDiskPath('/Rock')).toBe('disk:/Rock')
    expect(toClientPath('disk:/Rock')).toBe('/Rock')
  })

  it('YANDEX_MUSIC_PATH без префикса disk:', () => {
    process.env.YANDEX_MUSIC_PATH = 'лежни'
    expect(resolveDiskPath('/Rock')).toBe('disk:лежни/Rock')
  })

  it('YANDEX_MUSIC_PATH с префиксом disk:', () => {
    process.env.YANDEX_MUSIC_PATH = 'disk:/Music'
    expect(resolveDiskPath('/Rock')).toBe('disk:/Music/Rock')
  })
})
