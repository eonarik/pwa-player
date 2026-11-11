# Сервисы ядра

## Audio (src/services/audio/)

| Файл                    | Экспорты                          | Назначение                                                       |
| ----------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `AudioService.ts`       | `class AudioService`, singleton   | HTMLAudioElement + HLS, load/unload/play/pause/seek/volume/muted |
| `hls.ts`                | `HlsController`                   | Обёртка hls.js для потокового радио и стримов                    |
| `resources.ts`          | `ResourceHolder`                  | Управление objectURL (создание/освобождение Blob/File)           |
| `events.ts`             | `bindNativeEvents()`              | Привязка нативных audio-событий к внутреннему emitter            |
| `resolveTrackSource.ts` | `resolveTrackSource(track)`       | Выбор источника по priority из track.sources[]                   |
| `toPlayableUrl.ts`      | `toPlayableUrl(source, pluginId)` | Получение URL для воспроизведения через плагин                   |

**Методы AudioService**: `on(event, listener)`, `off()`, `emit()`, `load(source: string | File | Blob)`, `unload()`, `releaseCurrent()`, `play()`, `pause()`, `toggle()`, `seek(time)`, `seekBy(delta)`, `setVolume(value)`, `setMuted(muted)`. Getters: `element`, `currentTime`, `duration`, `paused`, `volume`, `muted`, `src`, `isLive`.

## Library (src/services/library/)

| Файл                       | Экспорты                                     | Назначение                                       |
| -------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `LibraryWriter.ts`         | `interface LibraryWriter`                    | Контракт записи в библиотеку                     |
| `EntityGraph.ts`           | `buildGraph()`                               | Индекс связей folder→tracks для быстрого доступа |
| `LibrarySaveService.ts`    | `saveToDisk()`                               | Сохранение снимка на файловую систему            |
| `selectors.ts`             | `getTracksByArtist()`, `getTracksByFolder()` | Чистые селекторы без реактивности                |
| `ReconciliationService.ts` | `reconcileFolders()`                         | Сверка папок при сканировании                    |
| `TrackMerger/merge.ts`     | `merge(incoming, options)`                   | Strict/soft/no match логика дедупликации         |
| `TrackMerger/apply.ts`     | `apply(mergeResult, writer)`                 | Запись результата merge в библиотеку             |
| `TrackMerger/saveCache.ts` | `saveCachesForPlugins(pluginIds)`            | Сохранение кэша плагинов после apply             |

## Metadata (src/services/metadata/)

| Файл                             | Экспорты                           | Назначение                                            |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `MetadataService/index.ts`       | `class MetadataService`, singleton | Единая точка изменения метаданных трека               |
| `MetadataService/fetch.ts`       | `createMetadataFetch()`            | Автопоиск: вызов провайдеров, выбор лучшего кандидата |
| `MetadataService/resolve.ts`     | `createMetadataResolve()`          | Разрешение конфликтов метаданных                      |
| `MetadataService/apply/`         | `createMetadataApply()`            | Применение результатов (remote/file/manual/candidate) |
| `MetadataService/reset.ts`       | `createMetadataReset()`            | Сброс метаданных к первичным (`track.raw`)            |
| `MetadataService/persistence.ts` | `createMetadataPersistence()`      | Хранение overrides в IndexedDB                        |
| `TrackMetadataService.ts`        | `class TrackMetadataService`       | HTTP-клиент к `/api/track-metadata`                   |
| `AutoFetchRegistry.ts`           | `registerPending()`, `flush()`     | Очередь автопоиска при загрузке                       |
| `runAutoFetch.ts`                | `runAutoFetch()`                   | Массовый автопоиск при старте                         |
| `MetadataWorkerService.ts`       | `parseID3(file)`                   | Парсинг ID3 через Web Worker                          |
| `types.ts`                       | `FetchedMetadata`, `ManualPatch`   | Типы                                                  |

**Публичный API MetadataService**: `fetchAndApply(trackId, signal?, force?)`, `fetchCandidates(trackId)`, `applyRemote(trackId, incoming)`, `applyFromFile(trackId, parsed, coverBlob?)`, `updateManual(trackId, patch)`, `applyCandidate(trackId, candidate)`, `reset(trackId)`, `resetMany(ids)`, `hasEntry(id)`, `getEntry(id)`, `markNotFound(id)`, `flush()`.

## Download & Sync (src/services/download/)

| Файл                      | Экспорты                               | Назначение                                       |
| ------------------------- | -------------------------------------- | ------------------------------------------------ |
| `DownloadOrchestrator.ts` | `orchestrate(tracks, dir)`             | Оркестрация скачивания (batch, progress, abort)  |
| `SyncService.ts`          | `syncWithLocal()`                      | Сверка локальных файлов с библиотечными записями |
| `PermissionService.ts`    | `ensurePermission(handle)`             | Запрос разрешения на файловую доступность        |
| `scanDirectory.ts`        | `scanDir(dirHandle)`                   | Сканирование директории (только аудиофайлы)      |
| `getFileFromPath.ts`      | `getFileFromPath(dirHandle, path)`     | Резолв файла по относительному пути              |
| `downloadUrlToFile.ts`    | `downloadUrlToFile(url, handle, opts)` | Скачивание URL → файл                            |
| `SpaceService.ts`         | `checkAvailableSpace()`                | Проверка места перед скачиванием                 |

## Persistence (src/services/persistence/)

| Файл                            | Экспорты            | Назначение                                  |
| ------------------------------- | ------------------- | ------------------------------------------- |
| `PersistenceService.ts`         | singleton           | Дебаунс-запись состояния плеера в IndexedDB |
| `PlaylistPersistenceService.ts` | singleton           | Загрузка/сохранение плейлистов              |
| `HistoryPersistenceService.ts`  | singleton           | Загрузка/сохранение истории                 |
| `DislikesPersistenceService.ts` | singleton           | Загрузка/сохранение дизлайков               |
| `MetadataPersistenceService.ts` | singleton           | Overrides метаданных                        |
| `restore.ts`                    | `restoreAll()`      | Восстановление всех данных при старте       |
| `SchemaService.ts`              | `migrateIfNeeded()` | Версионирование схемы IndexedDB             |
| `schema.ts`                     | дефолтные значения  | Схема хранения                              |
| `AlbumService.ts`               | CRUD альбомов       | Отдельное хранение альбомов                 |

## Other services

| Путь                                               | Класс/Функция                        | Роль                                                        |
| -------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `src/services/api/ApiClient.ts`                    | `class ApiClient`                    | HTTP-клиент: base URL, auth provider, retry, error handling |
| `src/services/api/errors.ts`                       | `ApiError`                           | Типизированные ошибки API                                   |
| `src/services/auth/AuthService.ts`                 | `class AuthService`                  | OAuth flow: start, callback, logout, check session          |
| `src/services/backup/BackupService.ts`             | `class BackupService`                | Экспорт/импорт данных в JSON с миграцией схемы              |
| `src/services/collections/ensureTrackInLibrary.ts` | `ensureTrackInLibrary(track)`        | Гарантирует существование трека в библиотеке                |
| `src/services/covers/CoverBlobCache.ts`            | `class CoverBlobCache`               | Кэш обложек в памяти (LRU, blob URLs)                       |
| `src/services/covers/findCoverInDirectory.ts`      | `findCover(dir, artist, album)`      | Поиск обложки среди файлов в папке                          |
| `src/services/files/FileHandlerRegistry.ts`        | `registerHandler(ext, fn)`           | Реестр обработчиков файлов (mp3, txt, image)                |
| `src/services/markdown/simpleRenderer.ts`          | `renderMarkdown(text)`               | Markdown → HTML для отображения текста                      |
| `src/services/plugins/connectPlugin.ts`            | `connectPlugin(manifest)`            | Полная цепочка connect → load → setLibrary                  |
| `src/services/pwa/PwaService.ts`                   | `updateAvailable()`, `applyUpdate()` | PWA update lifecycle                                        |
| `src/services/sort/SortService.ts`                 | `sortTracks(tracks, criteria)`       | Сортировка треков (artist/title/album/duration/year)        |
| `src/services/telemetry/TelemetryService.ts`       | `event(name, props)`                 | Анонимная телеметрия: очередь, batching, auto-flush         |
| `src/services/ui/ModalService.ts`                  | `show<T>(options)`                   | Модальные окна (input, confirm, custom component)           |
| `src/services/ui/ThemeService.ts`                  | `applyTheme(id)`, `getThemes()`      | CSS themes (barbie, neon, radio, tiffany)                   |
| `src/services/ui/ToastService.ts`                  | `info()`, `success()`, `error()`     | Тосты (auto-dismiss, queue)                                 |
