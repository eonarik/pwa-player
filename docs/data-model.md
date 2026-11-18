# Модель данных

Все ID — UUID (кроме системных констант вида `collection:history`, `playlist:favorites`).

Связи только через ID. Никаких вложенных массивов сущностей.

## Track

```ts
interface Track {
  id: TrackId; // UUID
  pluginId: string; // производное: pluginIdFromSource(sources[0].pluginId)
  artist: string;
  title: string;
  albumId: AlbumId | null; // ссылка на Album
  coverUrl: string | null; // только если альбома нет; иначе обложка на Album
  sources: TrackSource[]; // 1..N источников (один трек = несколько файлов)
  metadataCandidates: MetadataCandidate[];
  duplicateTrackIds: TrackId[]; // симметричные связи с треками-дубликатами
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

### Инварианты Track

- `pluginId` — **производное** поле. Пересчитывается `LibraryWriter` при каждой записи (`addTracks`, `updateTrackSources`) из `sources[0].pluginId` (после сортировки по `priority`). При пустых `sources` — `''`. Прямая запись `pluginId` запрещена.
- `sources` всегда отсортирован по `priority` (меньше = выше). Это делает `LibraryWriter.normalizeSources`.
- `duplicateTrackIds` — симметричные связи: если `A` в списке у `B`, то `B` в списке у `A`. Заполняется при soft-match в `TrackMerger`. Очищается после слияния (`applyDuplicates`).
- `albumId` и `coverUrl` взаимоисключающи по смыслу: если `albumId !== null`, обложка живёт на `Album.coverUrl`, а `Track.coverUrl = null`. Если `albumId === null`, обложка может быть на треке.

## MetadataSource

```ts
type MetadataSource = 'manual' | 'auto' | 'file' | 'filename';
```

- `manual` — ручная правка пользователем (модалка трека, выбор кандидата).
- `file` — теги из файла ID3.
- `auto` — автопоиск через провайдеров.
- `filename` — парсинг имени файла; дефолт после `reset()`.

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

### Приоритеты источников (соглашение)

- `10` — локальный файл (скачанный). Выигрывает у cloud/streaming.
- `20` — cloud (плагин задаёт).
- `30` — streaming (плагин задаёт).
- `999` — «виртуальный» импортированный источник (без реального файла), до auto-restore.

Приоритет задаёт плагин. `LibraryWriter` только сортирует.

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
  scanError?: string;
  scanStateUpdatedAt?: number;
}
```

## Album

```ts
interface Album {
  id: AlbumId;
  name: string;
  artist: string;
  coverUrl: string | null;
  coverBlob?: Blob | null; // обложка из ID3, если есть
  year?: number;
}
```

Альбомы хранятся отдельно от библиотеки в `player:albums` (см. `AlbumService`). В `useLibraryStore` — рабочая копия `albums: Record<AlbumId, Album>`.

## Playlist

```ts
interface Playlist {
  id: PlaylistId;
  name: string;
  trackIds: TrackId[];
  createdAt: number;
  updatedAt: number;
}
```

Системный плейлист: `id = 'playlist:favorites'` (`FAVORITES_PLAYLIST_ID`). Не удаляется, не переименовывается. Создаётся `ensureFavorites()` при `restore()`.

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

Persisted-форма (в IDB): массив `entries: Array<{ trackId, playedAt | dislikedAt }>` + `savedAt`. In-memory — `Record<TrackId, number>`. Конвертация в `useHistoryStore.restore` / `useDislikesStore.restore` и `save()`.

Лимит истории: 1000 записей FIFO (`HISTORY_MAX_SIZE`). Дизлайки — без лимита.

## MetadataCandidate

```ts
interface MetadataCandidate {
  id: MetadataCandidateId; // UUID
  artist: string;
  title: string;
  album: string;
  coverUrl: string | null;
  source: string; // 'itunes' | 'deezer' | 'zvuk'
  similarity: number; // 0..1
  provider: string; // id провайдера
  extMetadata?: Record<string, unknown>; // для плагина (applyCandidate)
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

`raw` — снимок первичных метаданных. Заполняется при первом `applyFromFile`/`updateManual`/`applyRemote` (`rawFromTrack`). Используется `reset()` для отката.

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

`alreadyApplied` используется в `useAppBootstrap`: если `true`, ядро не вызывает `writer.setLibrary` повторно (плагин уже применил снимок сам, например `yandex`, `yandex-self`).

## Хранение

| Данные                              | Где                    | Ключ / механизм                                         |
| ----------------------------------- | ---------------------- | ------------------------------------------------------- |
| Библиотека (tracks, folders)        | IndexedDB              | определяется плагином через `plugin.saveCache(context)` |
| Альбомы                             | IndexedDB (idb-keyval) | `player:albums`                                         |
| Плейлисты                           | IndexedDB              | `player:playlists`                                      |
| История                             | IndexedDB              | `player:history`                                        |
| Дизлайки                            | IndexedDB              | `player:dislikes`                                       |
| Состояние плеера (очередь, позиция) | IndexedDB              | `player:state`, `player:playback`                       |
| Кэш автопоиска метаданных           | IndexedDB              | `player:metadata`                                       |
| Версия схемы                        | IndexedDB              | `player:schemaVersion`                                  |
| UI настройки                        | localStorage           | `player:uiSettings`                                     |
| Папка скачивания                    | IndexedDB              | `player:downloadSpace`                                  |
| Данные плагинов (PluginStorage)     | IndexedDB              | `plugin:<pluginId>:<key>`                               |
| Статус активации плагина            | localStorage           | `plugin-activated:<pluginId>`                           |
| Legacy-ключ метаданных Zvuk         | localStorage           | `zvuk:fetchMetadata` (удаляется при миграции)           |

### Схема и миграции

`SchemaService.ensureCompatible()` при старте:

- `savedVersion === undefined` → записывает текущую, возвращает `false`.
- `savedVersion === SCHEMA_VERSION` → `false`.
- иначе → **`clear()` всего IDB** (wipe, не миграция), записывает текущую, возвращает `true`.

Отдельных миграций нет. При несовместимом изменении — bump `SCHEMA_VERSION`, данные теряются.

Legacy-ключи удаляются точечно через `migrations.ts` (например, `consumeLegacyMetadataToggle()` для `zvuk:fetchMetadata`).
