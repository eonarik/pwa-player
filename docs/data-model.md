# Модель данных

Все ID — UUID (кроме системных констант вида `collection:history`, `playlist:favorites`).

Связи только через ID. Никаких вложенных массивов сущностей.

## Track

```ts
interface Track {
  id: TrackId; // UUID
  pluginId: string; // приоритетный источник (для UI)
  artist: string;
  title: string;
  albumId: AlbumId | null; // ссылка на Album
  coverUrl: string | null;
  sources: TrackSource[]; // 1..N источников (один трек = несколько файлов)
  metadataCandidates: MetadataCandidate[];
  raw: RawMetadata | null; // исходные данные для сброса
  hasId3Tags: boolean;
  hasMetadataEdits?: boolean;
  metaSource?: MetadataSource; // 'manual' | 'auto' | 'file' | 'filename'
  duration?: number;
  codec?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
}
```

## TrackSource (дискриминированное объединение)

```ts
type TrackSource = LocalTrackSource | CloudTrackSource | StreamingTrackSource;

interface TrackSourceBase {
  id: TrackSourceId; // UUID
  pluginId: string;
  priority: number; // меньше = выше при выборе
}

interface LocalTrackSource extends TrackSourceBase {
  kind: 'local';
  handle: FileSystemFileHandle; // File System Access API
  folderId: FolderId;
  relativePath?: string;
}

interface CloudTrackSource extends TrackSourceBase {
  kind: 'cloud';
  remotePath: string; // путь на Яндекс.Диске
  folderId: FolderId;
}

interface StreamingTrackSource extends TrackSourceBase {
  kind: 'streaming';
  url: string; // прямой URL стрима
}
```

## FolderRef

```ts
interface FolderRef {
  id: FolderId;
  parentId: FolderId | null;
  pluginId: string;
  name: string;
  urlPath: string; // уникальный путь для роутинга
  trackIds: TrackId[]; // треки в папке
  files: FolderFile[]; // неаудио файлы
  scanState: FolderScanState; // 'pending' | 'scanning' | 'scanned' | 'error'
  scanProgress?: FolderScanProgress;
}
```

## Album

```ts
interface Album {
  id: AlbumId;
  name: string;
  artist: string;
  coverUrl: string | null;
  year?: number;
}
```

## Playlist

```ts
interface Playlist {
  id: PlaylistId;
  name: string;
  trackIds: TrackId[];
  createdAt: number;
  updatedAt: number;
}
// Системный: id = 'playlist:favorites'
```

## History / Dislikes

```ts
interface HistoryCollection {
  id: 'collection:history';
  playedAt: Record<TrackId, number>; // timestamp последнего воспроизведения
}

interface DislikesCollection {
  id: 'collection:dislikes';
  dislikedAt: Record<TrackId, number>;
}
```

## MetadataCandidate

```ts
interface MetadataCandidate {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string; // 'itunes' | 'deezer' | 'zvuk'
  similarity: number; // 0..1
}
```

## RawMetadata

```ts
interface RawMetadata {
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
}
```

## PluginSnapshot (обмен между плагином и ядром)

```ts
interface PluginSnapshot {
  folders: PluginFolderPayload[];
  tracks: PluginTrackPayload[];
  removedSourceIds?: TrackSourceId[];
  removedFolderIds?: FolderId[];
  alreadyApplied?: boolean; // true если плагин сам вызвал writer.setLibrary
}
```

## Хранение

| Данные                               | Где                    | Ключ                                     |
| ------------------------------------ | ---------------------- | ---------------------------------------- |
| Библиотека (tracks, albums, folders) | IndexedDB (idb-keyval) | `library`                                |
| Плейлисты                            | IndexedDB              | `playlists`                              |
| История                              | IndexedDB              | `history`                                |
| Дизлайки                             | IndexedDB              | `dislikes`                               |
| Состояние плеера (очередь, позиция)  | IndexedDB              | `player-state`, `player-playback`        |
| Метаданные (overrides)               | IndexedDB              | `metadata-overrides`                     |
| UI настройки                         | localStorage           | `cuei:ui-settings`                       |
| Ключи подключения плагинов           | localStorage           | `yandex-connected`, `plugin-activated:*` |
| FileSystemDirectoryHandle            | IndexedDB              | `download-dir-handle`                    |
