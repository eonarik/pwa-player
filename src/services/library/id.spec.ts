// src/services/library/id.spec.ts

import { describe, it, expect } from 'vitest'
import { folderIdFromPath, trackIdFromPath, ROOT_FOLDER_ID } from './id'

describe('folderIdFromPath', () => {
  it('возвращает id с префиксом folder:', () => {
    expect(folderIdFromPath('Rock')).toBe('folder:Rock')
  })

  it('сохраняет вложенные пути', () => {
    expect(folderIdFromPath('Rock/2020/OK Computer')).toBe('folder:Rock/2020/OK Computer')
  })

  it('возвращает folder: для пустого пути', () => {
    expect(folderIdFromPath('')).toBe('folder:')
  })

  it('не совпадает с ROOT_FOLDER_ID', () => {
    expect(folderIdFromPath('')).not.toBe(ROOT_FOLDER_ID)
  })
})

describe('trackIdFromPath', () => {
  it('возвращает id с префиксом track:', () => {
    expect(trackIdFromPath('Rock/track.mp3')).toBe('track:Rock/track.mp3')
  })

  it('работает с именами с пробелами и кириллицей', () => {
    expect(trackIdFromPath('Альбомы/2000 - Почти живой/01 Синие тени.mp3')).toBe(
      'track:Альбомы/2000 - Почти живой/01 Синие тени.mp3',
    )
  })
})

describe('ROOT_FOLDER_ID', () => {
  it('является строкой и не пустой', () => {
    expect(typeof ROOT_FOLDER_ID).toBe('string')
    expect(ROOT_FOLDER_ID.length).toBeGreaterThan(0)
  })
})
