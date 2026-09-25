// src/services/metadata/parseTrackMetadata.ts

import { parseBlob } from 'music-metadata-browser'
import type { TrackMetadata } from './types'

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
  const fallback: TrackMetadata = {
    title: titleFromFilename(file.name),
    artist: 'Unknown Artist',
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
      title: common.title?.trim() || fallback.title,
      artist: common.artist?.trim() || common.albumartist?.trim() || fallback.artist,
      album: common.album?.trim() || fallback.album,
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

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '')
  return withoutExt.replace(/^\d{1,3}[\s._-]+/, '').trim() || withoutExt
}

function createCoverUrl(picture: { data: Uint8Array | ArrayBuffer; format: string }): string {
  const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data)
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  const blob = new Blob([bytes], { type: picture.format })
  return URL.createObjectURL(blob)
}
