// src/services/metadata/parseTrackMetadata.ts

import { parseBlob } from 'music-metadata-browser'
import type { TrackMetadata } from './types'
import { guessMetadataFromFilename } from '@/utils/parseFilename'

export interface ParseContext {
  coverFile?: File | null
}

export async function parseTrackMetadata(
  file: File,
  context: ParseContext = {},
): Promise<TrackMetadata> {
  const guessed = guessMetadataFromFilename(file.name)

  try {
    const metadata = await parseBlob(file, {
      duration: true,
      skipCovers: false,
      skipPostHeaders: true,
    })

    const { common, format } = metadata

    // Проверяем, есть ли реальные теги артиста/альбома
    const hasRealTags = Boolean(common.artist?.trim() || common.album?.trim())

    const result: TrackMetadata = {
      title: common.title?.trim() || guessed.title,
      artist: hasRealTags
        ? common.artist?.trim() || common.albumartist?.trim() || ''
        : guessed.artist,
      album: hasRealTags ? common.album?.trim() || '' : '',
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
    return {
      title: guessed.title,
      artist: guessed.artist,
      album: '',
    }
  }
}

function createCoverUrl(picture: { data: Uint8Array | ArrayBuffer; format: string }): string {
  const data = picture.data instanceof Uint8Array ? picture.data : new Uint8Array(picture.data)
  const bytes = new Uint8Array(data.length)
  bytes.set(data)
  const blob = new Blob([bytes], { type: picture.format })
  return URL.createObjectURL(blob)
}
