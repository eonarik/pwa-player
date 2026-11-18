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

### Composition root и DI для плагинов

`src/plugins/context.ts` не импортирует `stores/library` и `services/download/*` напрямую — это разорвало бы рантайм-цикл. Вместо этого зависимости инжектятся через `src/plugins/contextDeps.ts`:

```ts
interface PluginContextDeps {
  createWriter(): LibraryWriter;
  getDownloadDir: (pluginId: string) => Promise<FileSystemDirectoryHandle | null>;
}
```

`setPluginContextDeps(deps)` вызывается в `main.ts` (composition root) до bootstrap. `getPluginContextDeps()` бросает, если deps не инициализирован.

## Жизненный цикл данных

### 1. Подключение плагина

```
Plugin.connect(context) -> Plugin.load(context) -> PluginSnapshot
                                                       |
                                                       v
                                    LibraryWriter.setLibrary(snapshot, sourceId)
                                                       |
                                                       v
                                          plugin.saveCache(context)  // дебаунс 2000ms
```

`connectPlugin(pluginIdOrSource, options)` — обёртка над `connect()` + опциональный `load()`. **Не создаёт snapshot** — это делает `plugin.load()` (внутри плагина). Возвращает `boolean`.

Если плагин сам вызвал `writer.setLibrary`, он ставит `snapshot.alreadyApplied = true`. Ядро (`useAppBootstrap`) проверяет флаг и не повторяет запись.

### 2. Воспроизведение трека

```
PlayerStore.playAt(index)
    -> [...track.sources].sort((a, b) => a.priority - b.priority)  // выбор по priority
    -> resolveTrackSource(track, source)  // резолв конкретного source
       -> local: handle.getFile()
       -> cloud: apiClient.ensureAuth(pluginId) + plugin.buildStreamUrl(source)
       -> streaming: source.url
    -> toPlayableUrl(url)  // HLS-прокси для .m3u8
    -> AudioService.load(resolved)
    -> AudioService.play()
```

Если `track.sources.length === 0` — `playAt` пробует `metadataService.fetchAndApply(track.id, undefined, true)` (force). Плагин через `applyCandidate` может добавить streaming-source.

**Auth-ошибки**: `resolveTrackSource` для cloud бросает `AuthError` (из `apiClient.ensureAuth`). `playAt` ловит, вызывает `handleAuthError(err, track, source.id)` + `continue` (перебирает следующие sources). Если все sources упали с `AuthError` — тишина (тост «Подключить?» уже показан).

### 3. Мэтчинг треков (TrackMerger)

При добавлении трека из любого источника (плейлист, история, дизлайк):

- **Strict match**: `artist` + `title` совпадают (после нормализации: NFC, trim, lowercase) -> источники объединяются в один Track
- **Soft match**: `artist` совпадает, `title` — подстрока -> создаётся `metadataCandidate` + `duplicateTrackIds` (симметричная связь)
- **No match**: создаётся новый Track

Оптимизация: `recordPlay`/`dislike` пропускают merge, если `isStrictSameTrack(existing, incoming)` (artist/title строго совпадают).

### 4. Метаданные

Иерархия приоритетов (`metaSource`):

1. Ручная правка (`'manual'`)
2. Теги из файла ID3 (`'file'`)
3. Автопоиск через провайдеров (`'auto'`)
4. Парсинг имени файла (`'filename'`, дефолт после `reset()`)

`MetadataService` собирается из 5 модулей (composition): `persistence`, `resolve`, `apply`, `reset`, `fetch`. `fetchAndApply()` (sequential) и `fetchCandidates()` (parallel) вызывают `resolve.resolveCandidates()`, который идёт по `uiSettings.metadataProviderOrder` + `isMetadataProviderEnabled`.

Built-in провайдеры (`itunes`, `deezer`) — часть ядра (`BUILTIN_METADATA_PROVIDERS`). Плагины участвуют, если у них `metadataPriority !== undefined`.

## Ключевые модули

| Модуль               | Путь                                                                                          | Роль                                         |
| -------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Registry             | `src/plugins/registry.ts`                                                                     | Реестр плагинов, загрузка, активация         |
| Extensions           | `src/plugins/extensions.ts`                                                                   | Сборка UI-расширений из плагинов             |
| ContextDeps          | `src/plugins/contextDeps.ts`                                                                  | DI для `PluginContext` (разрыв цикла)        |
| LibraryWriter        | `src/services/library/LibraryWriter.ts` (контракт), `src/stores/library/writer/` (реализация) | Единственная точка записи в библиотеку       |
| LibrarySaveService   | `src/services/library/LibrarySaveService.ts`                                                  | Дебаунс `plugin.saveCache(context)`          |
| TrackMerger          | `src/services/library/TrackMerger/`                                                           | Дедупликация треков при merge                |
| MetadataService      | `src/services/metadata/MetadataService/`                                                      | Фасад над 5 модулями                         |
| AudioService         | `src/services/audio/AudioService/`                                                            | Singleton обёртка над HTMLAudioElement + HLS |
| PersistenceService   | `src/services/persistence/`                                                                   | Дебаунс-запись в IndexedDB                   |
| BackupService        | `src/services/backup/`                                                                        | Экспорт/импорт данных в JSON                 |
| DownloadOrchestrator | `src/services/download/`                                                                      | Скачивание треков на диск                    |
| ApiClient            | `src/services/api/ApiClient.ts`                                                               | HTTP-клиент с AuthProvider и retry           |
| EventBus             | `src/services/events/bus.ts`                                                                  | Типизированный pub/sub                       |

## Поток данных (up)

```
Plugin (scan/load)
    -> PluginSnapshot { folders[], tracks[], alreadyApplied? }
        -> LibraryWriter.setLibrary()
            -> useLibraryStore (Pinia, in-memory)
                -> computed selectors (tracksByArtist, tracksByFolder)
                    -> Vue Components (reactive rendering)
```

## Поток данных (down)

```
User action (UI)
    -> Pinia Store action
        -> LibraryWriter (запись) + plugin.saveCache (через LibrarySaveService, дебаунс)
        -> Plugin (scanFolder, downloadTrack)
        -> eventBus (кросс-стор уведомления)
```

## EventBus

`src/services/events/bus.ts` — типизированный pub/sub. Полный `CoreEventMap`:

```ts
interface CoreEventMap {
  'track:metadata-updated': TrackId;
  'download:space-selected': void;
}
```

- `track:metadata-updated` — эмитится из `MetadataService` (`reset`, `apply/manual`, `apply/remote`, `apply/id3`) через `notifyTrackUpdated(trackId)`. Слушатели синхронизируют копии трека (например, очередь плеера).
- `download:space-selected` — эмитится из `DownloadSpaceService.pickSpace()`. Слушатель — `SyncService` (запускает `syncAll()`).

`queue:changed` **не существует** (устаревшее упоминание в старой версии документации).

Семантика: `on` возвращает `off`, `emit` изолирует ошибки обработчиков (snapshot-итерация, подписка/отписка во время dispatch не влияет на текущий emit).

## Bootstrap (двухфазный)

`main.ts` (composition root) → `bootstrap()`:

1. `setPluginContextDeps(...)`
2. `initTelemetry()`, `themeService.load()`
3. `schemaService.ensureCompatible()` — wipe IDB при смене версии
4. `navigator.storage.persist()`
5. `loadExtensions()`, `setupFileHandlers()`
6. Монтирование Vue
7. `flushAll` на `beforeunload`/`pagehide`/`visibilitychange`

`useAppBootstrap()`:

**Fast phase** (UI открывается сразу):

1. `uiSettings.load()`, `sortService.load()`, `metadataService.flush()`, `downloadSpaceService.load()`
2. `history.restore()`, `dislikes.restore()`, `playlists.restore()`
3. `library.restore()`, `library.reconcileFolderTrackIds()`

**Background phase**:

1. `syncService.scanPlugin(pluginId)` для `canDownload`
2. `plugin.restoreFromCache()` → `writer.setLibrary`; fallback `plugin.load()` → `writer.setLibrary` (с `alreadyApplied`)
3. `reconciliationService.reconcile()`, `cleanupOrphanAlbums()`
4. `player.restore()`
5. `cleanupOrphanTracks(playlists, history, dislikes, queue)` — строго после `player.restore`

## Известные отклонения от соглашений

- **Кросс-стор через прямые импорты** (нарушение `conventions.md`): `writer/index.ts` → `useUiSettingsStore`; `metadata/apply/merge.ts` → `usePlaylistsStore`/`useHistoryStore`/`useDislikesStore`; `player/actions/helpers.ts` → `useDislikesStore`. Это осознанные исключения, задокументированы.
- **`metadataPersistenceService.load()` не вызывается** при старте — CUEI-0026 (см. ROADMAP).
- **`AudioService.unload` vs `releaseCurrent`** — почти идентичны (разница в `hls.destroy/reset` и telemetry-событии). CUEI-0030.
