// src/services/metadata/constants.ts

/**
 * Плейсхолдер artist для треков с Яндекс.Диска без тегов.
 *
 * Ставится в `Folder.name` при построении дерева, чтобы не показывать
 * пустого исполнителя. Считается «невалидным» artist — если в теге трека
 * он остался, метаданные для него ищутся (см. `useMetadataSearch`).
 */
export const UNKNOWN_ARTIST_PLACEHOLDER = ''
