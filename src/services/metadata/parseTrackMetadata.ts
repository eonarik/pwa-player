// src/services/metadata/parseTrackMetadata.ts

import { parseBlob } from 'music-metadata-browser'
import type { TrackMetadata } from './types'
import { guessMetadataFromFilename } from '@/utils/parseFilename'

export interface ParseContext {
  folderName?: string
  rootFolderName?: string
  /** Внешний файл обложки, если найден в папке */
  coverFile?: File | null
}

/**
 * Парсит метаданные из File.
 * Чистая функция, не зависит от MetadataService.
 */
export async function parseTrackMetadata(
  file: File,
  context: ParseContext = {},
): Promise<TrackMetadata> {
  const guessed = guessMetadataFromFilename(file.name)

  const fallback: TrackMetadata = {
    title: guessed.title,
    artist: guessed.artist,
    // Если нет тегов, альбом берем из контекста (папки)
    album: context.folderName?.trim() || context.rootFolderName?.trim() || 'Unknown Album',
  }

  try {
    const metadata = await parseBlob(file, {
      duration: true,
      skipCovers: false,
      skipPostHeaders: true,
    })

    const { common, format } = metadata

    const result: TrackMetadata = {
      // Если в тегах пусто, используем guessed
      title: common.title?.trim() || guessed.title,
      artist: common.artist?.trim() || common.albumartist?.trim() || guessed.artist,
      // Альбом из тегов > папки > Unknown
      album:
        common.album?.trim() ||
        context.folderName?.trim() ||
        context.rootFolderName?.trim() ||
        'Unknown Album',
      year: common.year,
      trackNumber: common.track?.no ?? undefined,
      genre: common.genre?.[0],
      duration: format.duration,
      codec: format.codec,
    }

    if (context.coverFile) {
      result.coverUrl = URL.createObjectURL(context.coverFile)
    } else if (common.picture?.[0]) {
      result.coverUrl = createCoverUrl(common.picture[0])
    }

    return result
  } catch (err) {
    console.warn(`[parseTrackMetadata] failed to parse "${file.name}"`, err)
    return fallback
  }
}

function createCoverUrl(picture: { data: Uint8Array | ArrayBuffer; format: string }): string {
  const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data)
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  const blob = new Blob([bytes], { type: picture.format })
  return URL.createObjectURL(blob)
}
