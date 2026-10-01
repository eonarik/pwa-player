// src/services/library/id.spec.ts

import { describe, it, expect } from 'vitest'
import { folderIdFromPath, trackIdFromPath, ROOT_FOLDER_ID } from './id'

describe('folderIdFromPath', () => {
  it('возвращает id с префиксом folder:', () => {
    expect(folderIdFromPath('yandex', 'Rock')).toBe('folder:yandex:Rock')
  })

  it('сохраняет вложенные пути', () => {
    expect(folderIdFromPath('yandex', 'Rock/2020/OK Computer')).toBe(
      'folder:yandex:Rock/2020/OK Computer',
    )
  })

  it('возвращает __root__ для пустого пути', () => {
    expect(folderIdFromPath('yandex', '')).toBe('folder:yandex:__root__')
  })

  it('работает с local:Music', () => {
    expect(folderIdFromPath('local:Music', 'Album')).toBe('folder:local:Music:Album')
  })

  it('не совпадает с ROOT_FOLDER_ID', () => {
    expect(folderIdFromPath('yandex', '')).not.toBe(ROOT_FOLDER_ID)
  })
})

describe('trackIdFromPath', () => {
  it('возвращает id с префиксом track:', () => {
    expect(trackIdFromPath('yandex', 'Rock/track.mp3')).toBe('track:yandex:Rock/track.mp3')
  })

  it('работает с именами с пробелами и кириллицей', () => {
    expect(trackIdFromPath('local:Music', 'Альбомы/2000 - Почти живой/01 Синие тени.mp3')).toBe(
      'track:local:Music:Альбомы/2000 - Почти живой/01 Синие тени.mp3',
    )
  })
})

describe('ROOT_FOLDER_ID', () => {
  it('является строкой и не пустой', () => {
    expect(typeof ROOT_FOLDER_ID).toBe('string')
    expect(ROOT_FOLDER_ID.length).toBeGreaterThan(0)
  })
})
