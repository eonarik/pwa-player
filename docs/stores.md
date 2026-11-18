# Stores (Pinia)

## useLibraryStore

Единственный источник истины для треков, альбомов и папок.

```
src/stores/library/
├── index.ts          # re-exports
├── store/
│   ├── index.ts      # defineStore
│   ├── state.ts      # refs: tracks, albums, folders, currentFolderId
│   ├── computed.ts   # computed: tracksByArtist, tracksByFolder, ...
│   ├── actions.ts    # restore, getTrack, getAlbum, getFolder, ...
│   ├── cleanup.ts    # cleanupOrphanTracks, cleanupOrphanAlbums
│   ├── reconcile.ts  # reconcileFolderTrackIds
│   └── persist.ts    # setupPersistence (IndexedDB), flushLibrary
└── writer/
    ├── index.ts      # createLibraryWriter()
    ├── tracks.ts     # addTracks, removeTrack, updateTrackSources, ...
    ├── albums.ts     # addAlbums, addOrUpdateAlbum, removeAlbum
    ├── folders.ts    # setFolders, removeFolderRef, setFolderScanState, ...
    └── helpers.ts    # matchesSource
```

**State**: `tracks: Record<TrackId, Track>`, `albums: Record<AlbumId, Album>`, `folders: Record<FolderId, FolderRef>`, `currentFolderId`

**Computed**: `tracksByArtist`, `tracksByFolder`, `allTracks`, `allAlbums`

**Actions**: `restore()`, `getTrack(id)`, `getAlbum(id)`, `getFolder(id)`, `getFoldersBySource(sourceId)`

**Cleanup**: `cleanupOrphanTracks(playlists, history, dislikes, queue)`, `cleanupOrphanAlbums()` — удаляют сирот при старте (после `player.restore`).

**Writer** — `createLibraryWriter()` из `src/stores/library/writer/`. Реализует интерфейс `LibraryWriter` из `src/services/library/LibraryWriter.ts`. Единственная точка записи в библиотеку. Инвариант: `Track.pluginId` пересчитывается из `sources[0].pluginId` (после сортировки по `priority`).

## usePlayerStore

```
src/stores/player/
├── index.ts           # defineStore
├── actions/
│   ├── index.ts       # createPlayerActions
│   ├── types.ts       # PlayerActionsRefs, PlayerActionsCallbacks, PlayerActions
│   ├── helpers.ts     # shouldSkipAuto, isAnyPluginDisconnected
│   ├── playback.ts    # play/pause/stop/toggle/seek/setVolume/toggleMute/cycleRepeat
│   ├── queue.ts       # setQueue/playAll/removeFromQueue/clearQueue/removeTracksByPlugin
│   ├── navigation.ts  # playAt/next/prev/toggleShuffle/handleTrackEnd
│   └── errors.ts      # handleAuthError/skipToNextOnError
├── events.ts          # bindAudioEvents (подписка на AudioService)
├── timeLoop.ts        # requestAnimationFrame for currentTime
├── playerPersistence.ts # buildState, buildPlayback, flushPlayback
└── playerRestore.ts   # restorePlayerState, applyRestoredPlayback
```

**State**: `queue`, `originalQueue`, `currentIndex`, `currentTrack`, `isPlaying`, `duration`, `currentTime`, `volume`, `muted`, `repeatMode`, `shuffle`, `playbackVersion`

**Computed**: `hasNext`, `hasPrev`, `progress`

**Actions** (полный API из `PlayerActions`):

- **Queue**: `setQueue(tracks, startIndex?)`, `playAll(tracks)`, `removeFromQueue(index)`, `clearQueue()`, `removeTracksByPlugin(pluginId)`
- **Navigation**: `playAt(index): Promise<void>`, `next()`, `prev()`, `toggleShuffle()`, `handleTrackEnd()`
- **Playback**: `play()`, `pause()`, `stop()`, `toggle()`, `seek(time)`, `seekBy(delta)`, `setVolume(v)`, `setVolumeBy(delta)`, `toggleMute()`, `cycleRepeat()`
- **Errors**: `handleAuthError(error: AuthError, track: Track, failedSourceId?)`, `skipToNextOnError()`
- **Lifecycle**: `restore()`

**`playAt(index)`** — перебирает `[...track.sources].sort((a, b) => a.priority - b.priority)`, для каждого вызывает `resolveTrackSource(track, source)` + `audioService.load()` + `audioService.play()`. При `AuthError` — `handleAuthError(err, track, source.id)` + `continue` (не break). При исчерпании всех sources: если был `authFailed` — тишина (тост «Подключить?» уже показан); иначе — `toastService.error` + `skipToNextOnError()`.

**Auto-restore**: если `track.sources.length === 0`, `playAt` вызывает `metadataService.fetchAndApply(track.id, undefined, true)` (force). Если `applyCandidate` от плагина добавил streaming-source — играет.

**`handleAuthError(error, track, failedSourceId?)`** — выбирает `failedSource` (если id передан) или приоритетный (`priority` min). Сообщение: `refresh-expired` или (`no-refresh-token` && `hasRefreshToken`) → «Сессия истекла. Подключить источник заново?», иначе — «Источник не подключён. Подключить?». Кнопка «Подключить» → `connectPlugin(pluginId)` → если успех, повторный `playAt(currentIndex)`.

**`skipToNextOnError()`** — ищет следующий playable через `findPlayableIndex(queue, currentIndex + 1, 1, shouldSkipAuto)`. При `repeatMode === 'all'` — wrap. Иначе — pause.

**`handleTrackEnd()`** — `repeatMode === 'one'` → seek(0) + play; иначе `next()`.

**`next()`/`prev()`** — no-op для live-стримов (`isLiveStream(currentTrack.pluginId)`). `prev` при `currentTime > 3` → seek(0).

**`shouldSkipAuto(track)`** — `isDisliked` → skip; `getPlayability` → `missing`/`downloading` → skip.

**Persistence**: `queue`, `currentIndex`, `volume`, `muted`, `repeatMode`, `shuffle` — сохраняются с дебаунсом (`player:state`). `currentTime` — отдельно (`player:playback`).

**Подписки**: `events.ts` — `bindAudioEvents` (AudioService). `queue:changed` **не существует** (устаревшее упоминание).

## usePlaylistsStore

```ts
// State
playlists: Record<PlaylistId, Playlist>;

// Computed
(sortedPlaylists, favorites, favoriteTrackIds);

// Actions
(restore(),
  save(),
  createPlaylist(name),
  renamePlaylist(id, name),
  deletePlaylist(id),
  addTracksToPlaylist(id, tracks),
  removeTrackFromPlaylist(id, trackId),
  isFavorite(trackId),
  toggleFavorite(track): Promise<boolean>,
  getPlaylist(id),
  clear(),
  flush());
```

`FAVORITES_PLAYLIST_ID = 'playlist:favorites'` — системный плейлист. `ensureFavorites()` создаёт при `restore()`. `renamePlaylist`/`deletePlaylist` — no-op для favorites.

При добавлении треков в плейлист всегда проходит через `TrackMerger.merge()` → `apply()` → `saveCachesForPlugins()`. Локальный `libraryIndex` обновляется после каждого трека, чтобы следующие видели только что добавленные.

`save()` использует `JSON.parse(JSON.stringify(p))` для снятия реактивных Proxy перед записью в IDB.

## useHistoryStore

```ts
// State
history: HistoryCollection { playedAt: Record<TrackId, number> }

// Computed
entries, sortedHistory, uniqueHistory, isEmpty

// Actions
restore(), save(), recordPlay(track), clear(), getEntry(trackId), flush()
```

`recordPlay(track)`:

- если трек в библиотеке и `isStrictSameTrack(existing, incoming)` (artist/title строго совпадают после `trim().toLowerCase()`) — merge/apply **пропускается** (оптимизация).
- иначе — `TrackMerger.merge()` → `apply()` → `saveCachesForPlugins()` для создания/обновления трека.
- `HISTORY_MAX_SIZE = 1000` FIFO.

`uniqueHistory` — алиас `entries` (не дедупликация).

## useDislikesStore

```ts
// State
dislikes: DislikesCollection { dislikedAt: Record<TrackId, number> }

// Computed
entries, sortedEntries, dislikedIds

// Actions
restore(), save(), isDisliked(trackId), dislike(track), undislike(trackId),
toggleDislike(track): Promise<boolean>, clear(), flush()
```

Логика аналогична истории: `isStrictSameTrack` оптимизация, merge/apply при необходимости. **Без FIFO-лимита** (в отличие от истории).

`sortedEntries` — алиас `entries`.

`isStrictSameTrack` — **дублируется** в `history.ts` и `dislikes.ts` (кандидат на вынос).

## useUiSettingsStore

```ts
// State
(autoFetchMetadata,
  autoDownloadTracks,
  showSource,
  showFiles,
  metadataThreshold,
  searchThreshold,
  playlistMatchThreshold,
  metadataProviderOrder,
  metadataProviderEnabled);

// Actions
(load(),
  flush(),
  toggleShowSource(),
  setMetadataThreshold(value),
  setSearchThreshold(value),
  setPlaylistMatchThreshold(value),
  setMetadataProviderOrder(order),
  isMetadataProviderEnabled(id),
  toggleMetadataProvider(id, enabled));
```

**Дефолты**: `autoFetchMetadata=true`, `autoDownloadTracks=false`, `showSource=false`, `showFiles=false`, `metadataThreshold=0.75`, `searchThreshold=0.75`, `playlistMatchThreshold=0.75`.

**`load()` идемпотентен** (`isLoaded` флаг). Читает из `localStorage` ключ `player:uiSettings`. Побочный эффект: одноразовое потребление legacy-ключа `zvuk:fetchMetadata`.

**`metadataProviderOrder`** — порядок **всех** провайдеров (включённых и выключенных). **`metadataProviderEnabled`** — `Record<string, boolean>`, отсутствие ключа = «включён по умолчанию». `isMetadataProviderEnabled(id) { return metadataProviderEnabled.value[id] !== false; }`.

**`setMetadataProviderOrder`** санитизирует (dedupe, только строки), но **не дополняет** недостающими — это делает `normalizeProviderOrder` при `readFromStorage`.

**`toggleMetadataProvider(id, enabled)`**: `enabled = true` → **удаляет ключ** из `metadataProviderEnabled`; `enabled = false` → ставит `false`.

**Default `metadataProviderOrder`** — built-in (`itunes`, `deezer`) + плагины с `metadataPriority` (по возрастанию).

Схема хранения в `./schema.ts`: санитайзеры, миграции, дефолты.

## useCollectionsStore

**Composable-фасад**, не Pinia store. `export function useCollectionsStore()` вызывает `usePlaylistsStore()`, `useHistoryStore()`, `useDislikesStore()` и возвращает plain object с делегированием. Не хранит состояние.

## Вспомогательные stores

| Store                | Путь                      | Роль                                 |
| -------------------- | ------------------------- | ------------------------------------ |
| `useLibraryStore`    | `src/stores/library/`     | Библиотека (tracks, albums, folders) |
| `usePlayerStore`     | `src/stores/player/`      | Очередь, воспроизведение, время      |
| `usePlaylistsStore`  | `src/stores/playlists.ts` | Плейлисты                            |
| `useHistoryStore`    | `src/stores/history.ts`   | История                              |
| `useDislikesStore`   | `src/stores/dislikes.ts`  | Дизлайки                             |
| `useUiSettingsStore` | `src/stores/uiSettings/`  | Настройки UI                         |

## Порядок инициализации при старте

`main.ts` (composition root) → `bootstrap()`:

1. `setPluginContextDeps(...)` — DI для плагинов
2. `initTelemetry()` (если `VITE_TELEMETRY === 'true'`)
3. `themeService.load()`
4. `schemaService.ensureCompatible()` — wipe IDB при смене версии
5. `navigator.storage.persist()`
6. `loadExtensions()` — расширения плагинов
7. `setupFileHandlers()`
8. Монтирование Vue-приложения
9. `flushAll` на `beforeunload`/`pagehide`/`visibilitychange`

`useAppBootstrap()` (в `App.vue` или компоненте):

**Fast phase**:

1. `uiSettings.load()` — настройки из localStorage
2. `sortService.load()`
3. `metadataService.flush()` (странно: flush перед restore; возможно, должно быть `load()`)
4. `downloadSpaceService.load()` — папка скачивания
5. `history.restore()`
6. `dislikes.restore()`
7. `playlists.restore()` — `ensureFavorites()`
8. `library.restore()` — библиотека (персистится плагинами через `saveCache`)
9. `library.reconcileFolderTrackIds()`

**Background phase**:

1. `syncService.scanPlugin(pluginId)` для каждого `canDownload` (если `hasSpace` и `!needsPermission`)
2. Для каждого плагина: `plugin.restoreFromCache()` → `writer.setLibrary`; fallback `plugin.load()` → `writer.setLibrary` (с проверкой `snapshot.alreadyApplied`)
3. `reconciliationService.reconcile()`
4. `library.cleanupOrphanAlbums()`
5. `player.restore()`
6. `library.cleanupOrphanTracks(playlists, history, dislikes, queue)` — строго после `player.restore`

**`metadataPersistenceService.load()` не вызывается** — CUEI-0026 (см. ROADMAP), кэш автопоиска не поднимается между сессиями.
