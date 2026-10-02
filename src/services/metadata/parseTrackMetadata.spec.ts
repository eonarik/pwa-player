// oxlint-disable vitest/require-mock-type-parameters
// src/services/metadata/parseTrackMetadata.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseTrackMetadata } from './parseTrackMetadata'

// Мокаем music-metadata-browser
const parseBlobMock = vi.fn()
vi.mock('music-metadata-browser', () => ({
  parseBlob: (...args: unknown[]) => parseBlobMock(...args),
}))

function makeFile(name: string, content: string = 'audio-data'): File {
  return new File([content], name, { type: 'audio/mpeg' })
}

describe('parseTrackMetadata', () => {
  beforeEach(() => {
    parseBlobMock.mockReset()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `blob:mock-${Math.random().toString(36).slice(2)}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  // --- Fallback (парсер не дал метаданных) ------------------------------

  it('title из имени файла, если parseBlob вернул пусто', async () => {
    parseBlobMock.mockResolvedValueOnce({
      common: {},
      format: {},
    })

    const file = makeFile('Karma Police.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('Karma Police')
  })

  it('убирает расширение из fallback-title', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('Song Title.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('Song Title')
  })

  it('не убирает ведущие цифры — это может быть часть названия', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('30 Seconds to Mars.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('30 Seconds to Mars')
  })

  it('fallback-artist пустой', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.artist).toBe('')
  })

  it('fallback-album из folderName', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file, { folderName: 'OK Computer' })

    expect(result.album).toBe('OK Computer')
  })

  it('fallback-album из rootFolderName, если folderName не задан', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file, { rootFolderName: 'Music' })

    expect(result.album).toBe('Music')
  })

  it('fallback-album = Unknown Album, если ни folderName, ни rootFolderName', async () => {
    parseBlobMock.mockResolvedValueOnce({ common: {}, format: {} })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.album).toBe('Unknown Album')
  })

  // --- Успешный парсинг -------------------------------------------------

  it('читает теги из parseBlob', async () => {
    parseBlobMock.mockResolvedValueOnce({
      common: {
        title: 'Karma Police',
        artist: 'Radiohead',
        album: 'OK Computer',
        year: 1997,
        track: { no: 6 },
        genre: ['Alternative Rock'],
      },
      format: {
        duration: 261.5,
        codec: 'MP3',
      },
    })

    const file = makeFile('whatever.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('Karma Police')
    expect(result.artist).toBe('Radiohead')
    expect(result.album).toBe('OK Computer')
    expect(result.year).toBe(1997)
    expect(result.trackNumber).toBe(6)
    expect(result.genre).toBe('Alternative Rock')
    expect(result.duration).toBe(261.5)
    expect(result.codec).toBe('MP3')
  })

  it('fallback на albumartist, если artist не задан', async () => {
    parseBlobMock.mockResolvedValueOnce({
      common: { albumartist: 'Various Artists' },
      format: {},
    })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.artist).toBe('Various Artists')
  })

  // --- Обработка ошибок -------------------------------------------------

  it('возвращает fallback при исключении parseBlob', async () => {
    parseBlobMock.mockRejectedValueOnce(new Error('parse error'))

    const file = makeFile('Karma Police.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('Karma Police')
    expect(result.artist).toBe('')
  })

  // --- Обложка из тегов -------------------------------------------------

  it('создаёт blob URL из встроенной обложки', async () => {
    const picture = {
      data: new Uint8Array([1, 2, 3]),
      format: 'image/jpeg',
    }

    parseBlobMock.mockResolvedValueOnce({
      common: { picture: [picture] },
      format: {},
    })

    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.coverUrl).toMatch(/^blob:/)
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('приоритет — внешняя обложка (coverFile), если задана', async () => {
    parseBlobMock.mockResolvedValueOnce({
      common: { picture: [{ data: new Uint8Array([1]), format: 'image/jpeg' }] },
      format: {},
    })

    const coverFile = new File(['cover'], 'folder.jpg', { type: 'image/jpeg' })
    const file = makeFile('Song.mp3')
    const result = await parseTrackMetadata(file, { coverFile })

    expect(result.coverUrl).toMatch(/^blob:/)
    // createObjectURL вызван с coverFile, не с picture
    expect(URL.createObjectURL).toHaveBeenCalledWith(coverFile)
  })

  // --- Триминг whitespace ----------------------------------------------

  it('тримит пробелы в тегах', async () => {
    parseBlobMock.mockResolvedValueOnce({
      common: {
        title: '  Song  ',
        artist: '  Artist  ',
        album: '  Album  ',
      },
      format: {},
    })

    const file = makeFile('whatever.mp3')
    const result = await parseTrackMetadata(file)

    expect(result.title).toBe('Song')
    expect(result.artist).toBe('Artist')
    expect(result.album).toBe('Album')
  })
})
