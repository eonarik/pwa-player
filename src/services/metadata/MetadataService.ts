// src/services/metadata/MetadataService.ts

import { parseBlob } from 'music-metadata-browser'
import type { TrackMetadata } from './types'

export interface ReadContext {
  folderName?: string
  rootFolderName?: string
  /** Внешний файл обложки, если найден в папке */
  coverFile?: File | null
}

export class MetadataService {
  private static instance: MetadataService | null = null

  static getInstance(): MetadataService {
    if (!MetadataService.instance) {
      MetadataService.instance = new MetadataService()
    }
    return MetadataService.instance
  }

  /**
   * Извлекает метаданные из аудиофайла.
   * Если теги отсутствуют — падает на имя файла.
   */
  async read(file: File, context: ReadContext = {}): Promise<TrackMetadata> {
    const fallback = this.buildFallback(file, context)

    try {
      const metadata = await parseBlob(file, {
        duration: true,
        skipCovers: false,
        skipPostHeaders: true,
      })

      const { common, format } = metadata

      const result: TrackMetadata = {
        title: common.title?.trim() || fallback.title,
        artist: common.artist?.trim() || common.albumartist?.trim() || fallback.artist,
        album: common.album?.trim() || fallback.album,
        year: common.year,
        trackNumber: common.track?.no ?? undefined,
        genre: common.genre?.[0],
        duration: format.duration,
        codec: format.codec,
      }

      // Приоритет: внешняя обложка > встроенная
      if (context.coverFile) {
        result.coverUrl = URL.createObjectURL(context.coverFile)
      } else if (common.picture?.[0]) {
        result.coverUrl = this.createCoverUrl(common.picture[0])
      }

      return result
    } catch (err) {
      console.warn(`[MetadataService] failed to parse "${file.name}"`, err)
      return fallback
    }
  }

  private buildFallback(file: File, context: ReadContext): TrackMetadata {
    // Альбом: имя родительской папки, иначе — корневой папки
    const albumFromFolder =
      context.folderName?.trim() || context.rootFolderName?.trim() || 'Unknown Album'

    return {
      title: this.titleFromFilename(file.name),
      artist: 'Unknown Artist',
      album: albumFromFolder,
    }
  }

  /**
   * Пакетная обработка с ограничением параллелизма.
   * Парсинг 1000 файлов одновременно заморозит вкладку.
   */
  async readMany(
    entries: Array<{ file: File; folderName?: string; coverFile?: File | null }>,
    options: {
      rootFolderName?: string
      concurrency?: number
      onProgress?: (done: number, total: number) => void
    } = {},
  ): Promise<TrackMetadata[]> {
    const { rootFolderName, concurrency = 4, onProgress } = options
    const results: TrackMetadata[] = new Array(entries.length)
    let done = 0
    let cursor = 0

    const worker = async (): Promise<void> => {
      while (cursor < entries.length) {
        const index = cursor++
        const { file, folderName, coverFile } = entries[index]!
        results[index] = await this.read(file, {
          folderName,
          rootFolderName,
          coverFile, // ← вот это
        })
        done++
        onProgress?.(done, entries.length)
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, () => worker()))

    return results
  }

  // --- Хелперы ----------------------------------------------------------

  /**
   * Достаёт имя без расширения и без ведущих цифр-нумерации.
   * "01 - Artist - Title.mp3" → "Artist - Title"
   * "track01.mp3" → "track01"
   */
  private titleFromFilename(filename: string): string {
    const withoutExt = filename.replace(/\.[^.]+$/, '')
    // Убираем ведущий трек-номер вида "01 ", "01. ", "01 - "
    return withoutExt.replace(/^\d{1,3}[\s._-]+/, '').trim() || withoutExt
  }

  /**
   * Превращает picture из тега в blob URL.
   * ВАЖНО: этот URL нужно revoke, когда трек больше не нужен.
   */
  private createCoverUrl(picture: { data: Uint8Array | ArrayBuffer; format: string }): string {
    const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data)

    // Копируем в новый Uint8Array, потому что data может быть view
    // на буфер большего размера — иначе Blob захватит лишнее
    const bytes = new Uint8Array(data.length)
    bytes.set(data)

    const blob = new Blob([bytes], { type: picture.format })
    return URL.createObjectURL(blob)
  }

  /** Освобождает blob URL обложки */
  revokeCover(url?: string): void {
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }
}

export const metadataService = MetadataService.getInstance()
