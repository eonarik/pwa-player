// src/services/metadata/utils.spec.ts

import { describe, it, expect } from 'vitest'
import { getParentFolderName, getFileName } from './utils'

describe('getParentFolderName', () => {
  it('извлекает имя родительской папки', () => {
    expect(getParentFolderName('Radiohead/OK Computer/01 - Airbag.mp3')).toBe('OK Computer')
  })

  it('возвращает undefined для файла в корне', () => {
    expect(getParentFolderName('track01.mp3')).toBe(undefined)
  })

  it('работает с одним уровнем вложенности', () => {
    expect(getParentFolderName('Rock/track.mp3')).toBe('Rock')
  })

  it('игнорирует пустые сегменты', () => {
    // Двойные слэши не должны ломать
    expect(getParentFolderName('Rock//track.mp3')).toBe('Rock')
  })
})

describe('getFileName', () => {
  it('возвращает имя файла из полного пути', () => {
    expect(getFileName('Rock/2020/track.mp3')).toBe('track.mp3')
  })

  it('возвращает входную строку, если путь — только имя файла', () => {
    expect(getFileName('track.mp3')).toBe('track.mp3')
  })

  it('игнорирует пустые сегменты', () => {
    expect(getFileName('Rock//track.mp3')).toBe('track.mp3')
  })
})
