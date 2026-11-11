# Архитектура

## Общая схема

```
+--------------------------------------------------------------+
|                        Vue 3 UI (SPA/PWA)                     |
|  Views -> Composables -> Pinia Stores -> Services -> IndexedDB|
+--------------------------------------------------------------+
        |                                    |
        | HTTP (ApiClient)                   | File System Access API
        v                                    v
+-------------------+              +---------------------+
|  Express Server   |              |  Local File System  |
|  (proxy + OAuth)  |              |  (handles, folders) |
+-------------------+              +---------------------+
        |
        v
+--------------------------------------------------------------+
|  External APIs: Yandex Disk, Zvuk, iTunes, Deezer, Radio     |
+--------------------------------------------------------------+
```

## Принцип: ядро не знает о плагинах

Ядро (stores, services, UI-компоненты) оперирует только контрактами:

- `LibrarySource` — интерфейс источника данных (сканирование, стриминг, скачивание)
- `PluginManifest` — декларация плагина (id, флаги, ленивые импорты)
- `PluginExtension` — UI-расширения (маршруты, кнопки, кастомные views)

Плагины регистрируются через glob `src/plugins/*/manifest.ts` при сборке.

## Жизненный цикл данных

### 1. Подключение плагина

```
Plugin.connect(context) -> Plugin.load(context) -> PluginSnapshot
                                                       |
                                                       v
                                    LibraryWriter.setLibrary(snapshot, sourceId)
                                                       |
                                                       v
                                          IndexedDB (library.folders, library.tracks)
```

### 2. Воспроизведение трека

```
PlayerStore.playAt(index)
    -> resolveTrackSource(track)    // выбор источника из track.sources[]
    -> plugin.buildStreamUrl(source) // получение URL
    -> AudioService.load(url)        // HTMLAudioElement или HLS
    -> AudioService.play()
    -> eventBus('track:metadata-updated') // синхронизация при изменении метаданных
```

### 3. Мэтчинг треков (TrackMerger)

При добавлении трека из любого источника (плейлист, история, дизлайк):

- **Strict match**: `artist` + `title` совпадают (после нормализации: NFC, trim, lowercase) -> источники объединяются в один Track
- **Soft match**: `artist` совпадает, `title` — подстрока -> создаётся `metadataCandidate`
- **No match**: создаётся новый Track

### 4. Метаданные

Иерархия приоритетов:

1. Ручная правка (`metaSource: 'manual'`)
2. Теги из файла ID3 (`metaSource: 'file'`)
3. Автопоиск через провайдеров (`metaSource: 'auto'`)
4. Парсинг имени файла (`metaSource: 'filename'`)

`MetadataService.fetchAndApply()` вызывает провайдеров в порядке `uiSettings.metadataProviderOrder`.

## Ключевые модули

| Модуль               | Путь                                     | Роль                                         |
| -------------------- | ---------------------------------------- | -------------------------------------------- |
| Registry             | `src/plugins/registry.ts`                | Реестр плагинов, загрузка, активация         |
| Extensions           | `src/plugins/extensions.ts`              | Сборка UI-расширений из плагинов             |
| LibraryWriter        | `src/services/library/LibraryWriter.ts`  | Единственная точка записи в библиотеку       |
| TrackMerger          | `src/services/library/TrackMerger/`      | Дедупликация треков при merge                |
| MetadataService      | `src/services/metadata/MetadataService/` | Единая точка изменения метаданных            |
| AudioService         | `src/services/audio/AudioService/`       | Singleton обёртка над HTMLAudioElement + HLS |
| PersistenceService   | `src/services/persistence/`              | Дебаунс-запись в IndexedDB                   |
| BackupService        | `src/services/backup/`                   | Экспорт/импорт данных в JSON                 |
| DownloadOrchestrator | `src/services/download/`                 | Скачивание треков на диск                    |
| ApiClient            | `src/services/api/ApiClient.ts`          | HTTP-клиент с AuthProvider и retry           |

## Поток данных (up)

```
Plugin (scan/load)
    -> PluginSnapshot { folders[], tracks[] }
        -> LibraryWriter.setLibrary()
            -> useLibraryStore (Pinia, in-memory)
                -> computed selectors (tracksByArtist, tracksByFolder)
                    -> Vue Components (reactive rendering)
```

## Поток данных (down)

```
User action (UI)
    -> Pinia Store action
        -> LibraryWriter (запись) + PersistenceService (сохранение)
        -> Plugin (scanFolder, downloadTrack)
        -> eventBus (кросс-стор уведомления)
```

## Svelte-like event bus

`src/services/events/bus.ts` — типизированный pub/sub для событий между сторами:

- `track:metadata-updated` — плеер обновляет очередь
- `queue:changed` — UI подписывается на изменения

Это исключает циклические зависимости между сторами.
