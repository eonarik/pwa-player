# Сервисы ядра

## Audio (src/services/audio/)

| Файл                           | Экспорты                            | Назначение                                                       |
| ------------------------------ | ----------------------------------- | ---------------------------------------------------------------- |
| `AudioService/index.ts`        | `AudioService`, `audioService`      | Реэкспорт singleton-экземпляра                                   |
| `AudioService/AudioService.ts` | `class AudioService`, singleton     | HTMLAudioElement + HLS, load/unload/releaseCurrent/play/pause/seek/volume/muted |
| `AudioService/hls.ts`          | `HlsController`                     | Обёртка hls.js для потокового радио и стримов                    |
| `AudioService/resources.ts`    | `ResourceHolder`                    | Управление objectURL (создание/освобождение Blob/File)           |
| `AudioService/events.ts`       | `bindNativeEvents()`                | Привязка нативных audio-событий к внутреннему emitter            |
| `types.ts`                     | `AudioEventMap`, `AudioListener`    | Типы событий аудио                                               |
| `resolveTrackSource.ts`        | `resolveTrackSource(track, source)` | Резолв конкретного `TrackSource` в `string \| File`              |
| `toPlayableUrl.ts`             | `toPlayableUrl(url)`                | HLS-прокси для `.m3u8`, иначе — как есть                         |

**Методы AudioService**: `on(event, listener): () => void`, `off(event, listener)`, `load(source: string | File | Blob)`, `unload()`, `releaseCurrent()`, `play()`, `pause()`, `toggle()`, `seek(time)`, `seekBy(delta)`, `setVolume(value)`, `setMuted(muted)`, `destroy()`. Getters: `element`, `currentTime`, `duration`, `paused`, `volume`, `muted`, `src`, `isLive`.

`emit()` — **private**. Публичный API — `on`/`off` (внутренний emitter, не конкурирует с `eventBus`).

**`resolveTrackSource(track, source)`** — принимает **конкретный** `TrackSource` (не выбирает по priority). Для `local` — `handle.getFile()`; для `cloud` — `apiClient.ensureAuth(pluginId)` + `plugin.buildStreamUrl(source)`; для `streaming` — `source.url`. Бросает `AuthError`, если сессия провайдера истекла.

**Выбор источника по priority** — в `usePlayerStore.playAt` (`src/stores/player/actions/navigation.ts`): `[...track.sources].sort((a, b) => a.priority - b.priority)` + перебор с `resolveTrackSource`.

**`toPlayableUrl(url)`** — подставляет `/api/hls-proxy?url=...` для `.m3u8`, иначе возвращает как есть. Плагин вызывает `buildStreamUrl` отдельно; `toPlayableUrl` — только прокси.

## Library (src/services/library/)

| Файл                       | Экспорты                                                                                                     | Назначение                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `LibraryWriter.ts`         | `interface LibraryWriter`, `CleanupScope`                                                                    | Контракт записи в библиотеку                    |
| `EntityGraph.ts`           | `buildGraph()`, `resolveAlbumByName()`                                                                       | Индекс связей folder→tracks, резолв альбома     |
| `LibrarySaveService.ts`    | `librarySaveService` (singleton)                                                                             | Дебаунс `plugin.saveCache(context)` по pluginId |
| `selectors.ts`             | `getTracksByArtist()`, `getTracksByFolder()`, `hasLocalSource()`, `hasStreamingSource()`, `getPlayability()` | Чистые селекторы без реактивности               |
| `ReconciliationService.ts` | `reconcileFolders()`                                                                                         | Сверка папок при сканировании                   |
| `TrackMerger/merge.ts`     | `merge(incoming, options)`, `mergeMany()`, `buildLibraryIndex()`, `isSameSource()`, `sourceKey()`            | Strict/soft/no match логика дедупликации        |
| `TrackMerger/apply.ts`     | `apply(mergeResult, { writer })`, `applyMany()`                                                              | Запись результата merge в библиотеку            |
| `TrackMerger/saveCache.ts` | `saveCachesForPlugins(pluginIds)`                                                                            | Сохранение кэша плагинов после apply            |

**`LibraryWriter` — интерфейс** (контракт). **Реализация** — `createLibraryWriter()` в `src/stores/library/writer/` (директория: `index.ts`, `tracks.ts`, `albums.ts`, `folders.ts`, `helpers.ts`). Ядро работает с интерфейсом.

**Инварианты writer**:

- `Track.pluginId` пересчитывается из `sources[0].pluginId` (после сортировки по `priority`) в `normalizeSources()`. При пустых sources — `''`.
- `sources` всегда отсортирован по `priority`.
- `setLibrary(snapshot, sourceId, opts?: { cleanup?: CleanupScope })` — `CleanupScope` (`folderScope`, `trackScope`) используется для force-scan: удаляет отсутствующие cloud-sources и папки в заданном scope.
- `alreadyApplied` в `PluginSnapshot` — если `true`, ядро не вызывает `setLibrary` повторно (см. `useAppBootstrap`).

**`librarySaveService`** — дебаунс 2000ms, `scheduleSave(pluginId)`, `flush(pluginId)`, `flushAll()`. Не пишет в IDB сам — вызывает `plugin.saveCache(context)`. Персистентность библиотеки **делегирована плагинам**.

## Metadata (src/services/metadata/)

| Файл                                  | Экспорты                                                                                                         | Назначение                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `MetadataService/index.ts`            | `class MetadataService`, singleton                                                                               | Фасад над 5 модулями                                              |
| `MetadataService/fetch.ts`            | `createMetadataFetch()`                                                                                          | `fetchAndApply` (sequential), `fetchCandidates` (parallel)        |
| `MetadataService/resolve.ts`          | `createMetadataResolve()`                                                                                        | Резолв кандидатов (sequential/parallel), `toCandidate`            |
| `MetadataService/reset.ts`            | `createMetadataReset()`                                                                                          | Сброс к `track.raw`, `resetMany`                                  |
| `MetadataService/persistence.ts`      | `createMetadataPersistence()`                                                                                    | Кэш автопоиска, `markNotFound`, `saveCacheForTrack`               |
| `MetadataService/constants.ts`        | `BUILTIN_METADATA_PROVIDERS`, `isBuiltinMetadataProvider()`                                                      | Встроенные провайдеры (itunes, deezer)                            |
| `MetadataService/migrations.ts`       | `consumeLegacyMetadataToggle()`                                                                                  | Legacy-ключ `zvuk:fetchMetadata`                                  |
| `MetadataService/types.ts`            | `ApplyResult`, `ManualPatch`, `FetchResult`, `ResolvedCandidate`, `ResolveMode`, `ResolveResult`, `RemoteResult` | Типы                                                              |
| `MetadataService/apply/index.ts`      | `createMetadataApply()`                                                                                          | Сборка `apply/` подмодулей                                        |
| `MetadataService/apply/remote.ts`     | `createRemoteApply()`                                                                                            | `applyRemote`, `applyPatch`                                       |
| `MetadataService/apply/id3.ts`        | `createId3Apply()`                                                                                               | `applyFromFile`                                                   |
| `MetadataService/apply/manual.ts`     | `createManualApply()`                                                                                            | `updateManual`                                                    |
| `MetadataService/apply/candidate.ts`  | `createCandidateApply()`                                                                                         | `applyCandidate`, `invokeApplyCandidate`                          |
| `MetadataService/apply/duplicates.ts` | `pickPrimaryTrackId()`, `applyDuplicates()`                                                                      | Выбор основного и склейка дубликатов                              |
| `MetadataService/apply/merge.ts`      | `mergeTrackInto(source, target)`                                                                                 | Слияние дубля: sources + плейлисты/история/дизлайки + removeTrack |
| `MetadataService/apply/shared.ts`     | `norm()`, `notifyTrackUpdated()`, `attachAlbum()`, `rawFromTrack()`                                              | Общие утилиты apply                                               |
| `AutoFetchRegistry.ts`                | `isProcessed()`, `markProcessed()`, `resetProcessedTrack()`                                                      | Set обработанных trackId                                          |
| `runAutoFetch.ts`                     | `runAutoFetch(track)`                                                                                            | Одиночный автопоиск (не массовый)                                 |
| `MetadataWorkerService.ts`            | `metadataWorkerService` (singleton)                                                                              | Очередь парсинга ID3 через Web Worker                             |
| `TrackMetadataService.ts`             | `trackMetadataService` (singleton)                                                                               | HTTP-клиент к `/api/track-metadata`, `fetchItunes`, `fetchDeezer` |
| `types.ts`                            | `TrackMetadata`, `ParsedId3`                                                                                     | Типы                                                              |

**`MetadataService` собирается из 5 модулей** через composition в `index.ts`:

- `createMetadataPersistence()`
- `createMetadataResolve()`
- `createMetadataApply(persistence)`
- `createMetadataReset(persistence)`
- `createMetadataFetch(persistence, resolve, apply)`

**Публичный API MetadataService**: `fetchAndApply(trackId, signal?, force?)`, `fetchCandidates(trackId)`, `applyRemote(trackId, incoming)`, `applyFromFile(trackId, parsed, coverBlob?)`, `updateManual(trackId, patch)`, `applyCandidate(trackId, candidate)`, `pickPrimaryTrackId(ids)`, `applyDuplicates(primaryId, duplicateIds)`, `reset(trackId)`, `resetMany(ids)`, `hasEntry(id)`, `getEntry(id)`, `markNotFound(id)`, `flush()`.

**`applyPatch`** — внутренний метод `applyRemote`, не в публичном API. Логика перезаписи: `canOverwriteArtist = (isArtistStrict || force) && (!hasMetadataEdits || force)`; `canOverwriteTitle = (allowMetadataOverwrite || isArtistStrict || force) && (!hasMetadataEdits || force)`.

**`applyFromFile`** — определяет `isManual` (сравнивает текущие значения с `raw`); если manual — **не перетирает** файлом. `hasId3Tags` обновляется как `parsed.hasId3Tags || track.hasId3Tags`. `coverBlob` идёт в `Album.coverBlob` (только если есть альбом и у него ещё нет обложки). `metaSource: 'file'` если `hasId3Tags`, иначе `'filename'`.

**`updateManual`** — `metaSource: 'manual'`, `hasMetadataEdits: true`, `raw: rawFromTrack(track, library)`. Если `coverUrl` — `blob:`, переносит в `Album.coverUrl` и обнуляет на треке.

**`applyCandidate`** — сначала `manual.updateManual(trackId, toManualPatch(candidate))`, потом `invokeApplyCandidate(provider, trackId, extMetadata)` — только если `extMetadata` есть (у built-in itunes/deezer его нет, поэтому для built-in `invokeApplyCandidate` не вызывается). `invokeApplyCandidate` проверяет `plugin.isDisconnected?.()` → пропускает; `plugin.applyCandidate` опционален; ошибка плагина логируется.

**`reset`** — при отсутствии `raw` сбрасывает только флаги (`albumId: null`, `coverUrl: null`, `metadataCandidates: []`, `hasMetadataEdits: false`, `metaSource: 'filename'`), не трогает artist/title. При наличии `raw` — `resolveAlbumByName` → `addOrUpdateAlbum` → `updateTrackMetadata` с `raw`-значениями. Эмитит `track:metadata-updated`.

**`resolve`** — `resolveSequential`: идёт по `getEnabledProviders()` (order из `uiSettings.metadataProviderOrder` + `isMetadataProviderEnabled`), built-in через `trackMetadataService.fetchItunes/fetchDeezer`, плагины через `loadPlugin(providerId).fetchMetadata()`. `confident && similarity >= threshold` → `confident`. Иначе собирает `candidates` с `similarity >= threshold`, сортирует по similarity. `resolveParallel` — все параллельно, `confident` сначала.

**`getEnabledProviders`** — плагин участвует, только если у него `metadataPriority !== undefined`. Удалённые плагины пропускаются.

**`runAutoFetch(track)`** — **одиночный** автопоиск: проверяет `uiSettings.autoFetchMetadata`, стриминговый плагин, `hasId3Tags`, наличие artist/album/cover, `metadataService.getEntry(track.id)` (not-found TTL). Если всё ок — `metadataService.fetchAndApply(track.id)`.

**`AutoFetchRegistry`** — `processedTracks: Set<string>`, `isProcessed`, `markProcessed`, `resetProcessedTrack`. Сбрасывается из `MetadataService.reset`.

**`MetadataPersistenceService`** — кэш автопоиска (не overrides!). `player:metadata`. TTL not-found — 7 дней. `load()` — **ленивая**, но в `main.ts`/`useAppBootstrap` **не вызывается** (потенциальный баг: кэш не подгружается при старте).

**`MetadataWorkerService`** — очередь (`QueueItem[]`), ленивый воркер (`new Worker(new URL('../../workers/metadata.worker.ts', import.meta.url), { type: 'module' })`). `parse(file): Promise<ParsedId3 | null>`. При ошибке — `resolve(null)`.

**`TrackMetadataService`** — `PROXY_URL = ''`, `REQUEST_TIMEOUT_MS = 10_000`. `fetchItunes`/`fetchDeezer` → `fetchByProvider(provider)`. Ответ содержит `candidates?: RemoteMetadataCandidate[]`. Если best-match от другого провайдера, но есть свои кандидаты — берёт лучшего из своих. 4xx → `not-found`, 5xx → `error`.

## Download & Sync (src/services/download/)

| Файл                      | Экспорты                                                                            | Назначение                                           |
| ------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `DownloadOrchestrator.ts` | `class DownloadOrchestrator`, `downloadOrchestrator`                                | Фасад: одиночное/батч/удаление/скан                  |
| `active-downloads.ts`     | `createActiveDownloads()`, `ActiveDownloads`, `DownloadProgress`                    | Реестр активных загрузок (реактивный)                |
| `batch.ts`                | `createBatchRunner()`, `selectDownloadable()`, `BatchRunner`                        | Последовательный батч                                |
| `single-track.ts`         | `downloadTrackInternal()`, `MAX_DOWNLOAD_ATTEMPTS`                                  | Скачивание одного трека с повторами                  |
| `manage.ts`               | `removeDownloaded(track)`, `scanDownloads(pluginId)`                                | Удаление скачанного, скан папки                      |
| `SyncService.ts`          | `class SyncService`, `syncService`                                                  | Сверка локальных файлов с библиотекой                |
| `DownloadSpaceService.ts` | `class DownloadSpaceService`, `downloadSpaceService`                                | Папка скачивания (IDB `player:downloadSpace`)        |
| `PermissionService.ts`    | `queryPermission()`, `requestPermission()`, `hasPermission()`                       | Права на папку                                       |
| `scanDirectory.ts`        | `scanDirectory(dir, prefix)`                                                        | Рекурсивный обход папки → `Map<string, ScannedFile>` |
| `getFileFromPath.ts`      | `getFileFromPath()`, `getFileHandleFromPath()`                                      | Резолв файла/handle по относительному пути           |
| `downloadUrlToFile.ts`    | `downloadUrlToFile(url, options)`                                                   | Скачивание URL → файл (streaming)                    |
| `types.ts`                | `TrackDownloadState`, `DownloadError`, `SyncIssues`, `SyncReport`, `SelectedIssues` | Типы                                                 |

**`DownloadOrchestrator`** — класс-singleton (`getInstance()`, `downloadOrchestrator`). Методы: `isDownloading(trackId)`, `getProgress(trackId)`, `cancel(trackId)`, `downloadTrack(track)`, `downloadMany(tracks)`, `cancelBatch()`, `removeDownloaded(track)`, `scan(pluginId)`. Getters: `version`, `isBatchDownloading`, `batchProgress`.

**`downloadTrackInternal(track, externalSignal, options)`** — `MAX_DOWNLOAD_ATTEMPTS = 3`. Ищет `cloud` source (вручную), `loadPlugin(pluginId)`, `downloadSpaceService.getPluginDir(pluginId)`, `active.begin(trackId, abort)`. Повторы: `DownloadError` 404/410 — не повторяются; `AbortError` — пробрасывается. `attachLocalSource` — `priority: 10`, локальный выигрывает. Если `track.sources[0]?.kind !== 'local'` — парсит ID3 через `metadataWorkerService.parse` и `metadataService.applyFromFile`.

**`SyncService`** — `isSyncing`, `issues`, `issueCount` (refs), `scanPlugin(pluginId)`, `syncAll()`, `resolveIssues(selected)`, `dismissIssues()`. Подписан на `eventBus.on('download:space-selected')` → `syncAll()`.

**`DownloadSpaceService`** — `hasSpace`, `spaceName`, `needsPermission` (refs), `load()`, `pickSpace()`, `getSpace()`, `getPluginDir(pluginId)`, `getPluginDirIfExists(pluginId)`, `refreshPermissionState()`, `requestAccess()`, `clear()`. `pickSpace()` эмитит `download:space-selected`.

**`PermissionService`** — `queryPermission(handle, mode)`, `requestPermission(handle, mode)`, `hasPermission(handle, mode)`. `requestPermission` — только внутри user gesture.

**`scanDirectory(dir, prefix)`** — рекурсивно, только файлы (все, не только аудио; фильтрация — на стороне плагина).

## Persistence (src/services/persistence/)

| Файл                            | Экспорты                                                | Назначение                                                                      |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `PersistenceService.ts`         | singleton                                               | Дебаунс-запись состояния плеера в IndexedDB (`player:state`, `player:playback`) |
| `PlaylistPersistenceService.ts` | singleton                                               | Загрузка/сохранение плейлистов (`player:playlists`)                             |
| `HistoryPersistenceService.ts`  | singleton                                               | Загрузка/сохранение истории (`player:history`)                                  |
| `DislikesPersistenceService.ts` | singleton                                               | Загрузка/сохранение дизлайков (`player:dislikes`)                               |
| `MetadataPersistenceService.ts` | singleton                                               | Кэш автопоиска метаданных (`player:metadata`)                                   |
| `AlbumService.ts`               | singleton                                               | Отдельное хранение альбомов (`player:albums`)                                   |
| `SchemaService.ts`              | singleton                                               | Версионирование схемы (`player:schemaVersion`), wipe при несовпадении           |
| `schema.ts`                     | `SCHEMA_VERSION`, `SCHEMA_VERSION_KEY`                  | Версия схемы                                                                    |
| `restore.ts`                    | `restoreTrack()`, `restoreTracks()`                     | Восстановление треков (не `restoreAll()`)                                       |
| `types.ts`                      | `PersistedTrack`, `PersistedState`, `PersistedPlayback` | Типы                                                                            |

**Три сервиса** (`PlaylistPersistenceService`, `HistoryPersistenceService`, `DislikesPersistenceService`) — **почти идентичные** (дебаунс 500ms, `save`/`saveNow`/`flush`/`load`/`clear`). Кандидат на обобщение.

**`PersistenceService`** — дебаунс `state` 1000ms, `playback` 2000ms. `scheduleSaveState`, `saveStateNow`, `loadState`, `scheduleSavePlayback`, `savePlaybackNow`, `loadPlayback`, `clear`. `toPersisted` — identity-функция, не вызывается (CUEI-0029, мёртвый код).

**`SchemaService.ensureCompatible()`** — при смене версии `clear()` всего IDB (wipe, не миграция). Возвращает `true`, если версия изменилась и всё стёрто.

**`restore.ts`** — `restoreTrack(persisted)` восстанавливает `Track` (включая `duplicateTrackIds`, `metaSource`, `hasMetadataEdits`), `restoreTracks(persisted, concurrency = 8)`.

**`AlbumService`** — `loadAll()`, `save(albums)`, `saveNow(albums)`, `flush()`, `clear()`. `deepToRaw` + `structuredClone` перед `set`.

**`MetadataPersistenceService`** — `load()`, `get(trackId)`, `has(trackId)`, `setInMemory()`, `flush()`, `resetForTracks()`, `clear()`, `size()`. TTL not-found 7 дней.

## Other services

| Путь                                               | Класс/Функция                                        | Роль                                                                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/api/ApiClient.ts`                    | `class ApiClient`, `apiClient`                       | HTTP-клиент: base URL, auth provider, retry, error handling                                                                                                                              |
| `src/services/api/errors.ts`                       | `ApiError`, `AuthError`                              | Типизированные ошибки API (`AuthError` с `providerId`, `reason`)                                                                                                                         |
| `src/services/auth/AuthService.ts`                 | `class AuthService`                                  | OAuth flow: start, callback, logout, check session                                                                                                                                       |
| `src/services/backup/BackupService.ts`             | `class BackupService`                                | Экспорт/импорт данных в JSON с миграцией схемы                                                                                                                                           |
| `src/services/collections/ensureTrackInLibrary.ts` | `ensureTrackInLibrary(track)`                        | Гарантирует существование трека в библиотеке                                                                                                                                             |
| `src/services/covers/CoverBlobCache.ts`            | `class CoverBlobCache`                               | Кэш обложек в памяти (LRU, blob URLs)                                                                                                                                                    |
| `src/services/covers/findCoverInDirectory.ts`      | `findCover(dir, artist, album)`                      | Поиск обложки среди файлов в папке                                                                                                                                                       |
| `src/services/files/FileHandlerRegistry.ts`        | `registerHandler(ext, fn)`                           | Реестр обработчиков файлов (mp3, txt, image)                                                                                                                                             |
| `src/services/markdown/simpleRenderer.ts`          | `renderMarkdown(text)`                               | Markdown → HTML для отображения текста                                                                                                                                                   |
| `src/services/plugins/connectPlugin.ts`            | `connectPlugin(pluginIdOrSource, options)`           | `plugin.connect()` + опциональный `load()`. Возвращает `boolean` (true — успех, false — cancelled/redirect). **Не создаёт snapshot** — `plugin.load()` сам вызывает `writer.setLibrary`. |
| `src/services/pwa/PwaService.ts`                   | `updateAvailable()`, `applyUpdate()`                 | PWA update lifecycle                                                                                                                                                                     |
| `src/services/sort/SortService.ts`                 | `sortTracks(tracks, criteria)`                       | Сортировка треков (artist/title/album/duration/year)                                                                                                                                     |
| `src/services/telemetry/TelemetryService.ts`       | `event(name, props)`                                 | Анонимная телеметрия: очередь, batching, auto-flush                                                                                                                                      |
| `src/services/ui/ModalService.ts`                  | `show<T>(options)`                                   | Модальные окна (input, confirm, custom component)                                                                                                                                        |
| `src/services/ui/ThemeService.ts`                  | `applyTheme(id)`, `getThemes()`                      | CSS themes (barbie, neon, radio, tiffany)                                                                                                                                                |
| `src/services/ui/ToastService.ts`                  | `info()`, `success()`, `error()`, `showPersistent()` | Тосты (auto-dismiss, queue, persistent с action)                                                                                                                                         |

**`connectPlugin`** — не создаёт `PluginSnapshot` и не вызывает `writer.setLibrary`. Это делает `plugin.load()` (внутри плагина). `connectPlugin` — обёртка над `connect()` + опциональный `load()` (если `options.loadAfter`). Ловит `cancelled`/`redirect` → `false`.
