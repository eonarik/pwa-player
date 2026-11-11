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
│   └── persist.ts    # setupPersistence (IndexedDB)
└── writer/
    ├── index.ts      # createLibraryWriter()
    └── *.ts          # методы writer'а
```

**State**: `tracks: Record<TrackId, Track>`, `albums: Record<AlbumId, Album>`, `folders: Record<FolderId, FolderRef>`, `currentFolderId`

**Computed**: `tracksByArtist`, `tracksByFolder`, `allTracks`, `allAlbums`

**Actions**: `restore()`, `getTrack(id)`, `getAlbum(id)`, `getFolder(id)`, `getFoldersBySource(sourceId)`

**Cleanup**: `cleanupOrphanTracks()`, `cleanupOrphanAlbums()` — удаляют сироты при старте

## usePlayerStore

```
src/stores/player/
├── index.ts           # defineStore
├── actions.ts         # playAt, next, prev, play/pause, toggle, seek, setVolume
├── events.ts          # bindAudioEvents (подписка на AudioService)
├── timeLoop.ts        # requestAnimationFrame for currentTime
├── playerPersistence.ts # buildState, buildPlayback, flushPlayback
└── playerRestore.ts   # restorePlayerState, applyRestoredPlayback
```

**State**: `queue`, `originalQueue`, `currentIndex`, `currentTrack`, `isPlaying`, `duration`, `currentTime`, `volume`, `muted`, `repeatMode`, `shuffle`, `playbackVersion`

**Computed**: `hasNext`, `hasPrev`, `progress`

**Actions**: `playAt(index)`, `play()`, `pause()`, `toggle()`, `next()`, `prev()`, `seek(time)`, `setVolume(v)`, `setMuted(m)`, `setRepeatMode(mode)`, `setShuffle(on)`, `handleTrackEnd()`, `handleAuthError()`, `skipToNextOnError()`, `updateTrackInQueue(id)`, `restore()`

**Persistence**: `queue`, `currentIndex`, `volume`, `muted`, `repeatMode`, `shuffle` — сохраняются с дебаунсом. `currentTime` — отдельно.

## usePlaylistsStore

```ts
// State
playlists: Record<PlaylistId, Playlist>;

// Computed
(sortedPlaylists, favorites, favoriteTrackIds);

// Actions
(restore(),
  createPlaylist(name),
  renamePlaylist(id, name),
  deletePlaylist(id),
  addTracksToPlaylist(id, tracks),
  removeTrackFromPlaylist(id, trackId),
  isFavorite(trackId),
  toggleFavorite(track),
  getPlaylist(id),
  clear(),
  flush());
```

При добавлении треков в плейлист всегда проходит через `TrackMerger.merge()` → `apply()` → `saveCachesForPlugins()`.

## useHistoryStore

```ts
// State
history: HistoryCollection { playedAt: Record<TrackId, number> }

// Computed
entries, sortedHistory, uniqueHistory, isEmpty

// Actions
restore(), recordPlay(track), clear(), getEntry(trackId), flush()
```

`recordPlay(track)` — если трек не в библиотеке или метаданные отличаются, вызывает `TrackMerger.merge()` для создания/обновления трека. Ограничение: 1000 записей (FIFO).

## useDislikesStore

```ts
// State
dislikes: DislikesCollection { dislikedAt: Record<TrackId, number> }

// Computed
entries, sortedEntries, dislikedIds

// Actions
restore(), isDisliked(trackId), dislike(track), undislike(trackId),
toggleDislike(track), clear(), flush()
```

Логика аналогична истории: merge трека перед дизлайком.

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

Схема хранения в `./schema.ts`: санитайзеры, миграции, дефолты.

## useCollectionsStore

Фасад над playlists + history + dislikes. Не хранит состояние, только делегирует.

## usePlayerStore (вспомогательные)

| Store                | Путь                      | Роль                                 |
| -------------------- | ------------------------- | ------------------------------------ |
| `useLibraryStore`    | `src/stores/library/`     | Библиотека (tracks, albums, folders) |
| `usePlayerStore`     | `src/stores/player/`      | Очередь, воспроизведение, время      |
| `usePlaylistsStore`  | `src/stores/playlists.ts` | Плейлисты                            |
| `useHistoryStore`    | `src/stores/history.ts`   | История                              |
| `useDislikesStore`   | `src/stores/dislikes.ts`  | Дизлайки                             |
| `useUiSettingsStore` | `src/stores/uiSettings/`  | Настройки UI                         |

## Порядок инициализации при старте

1. `useUiSettingsStore().load()` — настройки из localStorage
2. `useLibraryStore().restore()` — библиотека из IndexedDB
3. `usePlaylistsStore().restore()` — плейлисты из IndexedDB
4. `useHistoryStore().restore()` — история из IndexedDB
5. `useDislikesStore().restore()` — дизлайки из IndexedDB
6. `usePlayerStore().restore()` — очередь плеера из IndexedDB
7. Загрузка и подключение плагинов
8. `cleanupOrphanTracks()` — удаление треков без источников
