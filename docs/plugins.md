# Плагины

## Контракт LibrarySource

```ts
interface LibrarySource {
  // Обязательные
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly canDownload: boolean;
  isAvailable(): boolean;
  connect(context: PluginContext): Promise<void>;
  load(context: PluginContext, options?: LoadOptions): Promise<PluginSnapshot>;
  restoreFromCache(context: PluginContext): Promise<PluginSnapshot | null>;
  disconnect(context: PluginContext): Promise<void>;
  buildStreamUrl(source: TrackSource): string;

  // Опциональные: состояние
  isDisconnected?(): boolean;
  checkSession?(): Promise<'ok' | 'expired' | 'unavailable'>;
  markDisconnected?(): void;

  // Опциональные: сканирование
  scanFolder?(ctx: PluginContext, folderId: FolderId, opts: ScanFolderOptions): Promise<PluginSnapshot>;
  canForceScan?(folderId: FolderId): boolean;

  // Опциональные: локальные файлы
  restoreFromLocalFiles?(ctx: PluginContext): Promise<PluginSnapshot | null>;
  mergeLocalIntoLibrary?(ctx: PluginContext): Promise<PluginSnapshot | null>;
  createLocalTrack?(ctx: PluginContext, relativePath: string, filename: string): Promise<Track | null>;

  // Опциональные: скачивание
  buildDownloadUrl?(track: Track, source: TrackSource): string;
  downloadTrack?(
    ctx: PluginContext,
    track: Track,
    source: TrackSource,
    opts: DownloadTrackOptions,
  ): Promise<DownloadedTrackInfo>;
  removeDownloaded?(
    ctx: PluginContext,
    track: Track,
    source: TrackSource,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<void>;
  scanDownloadDir?(ctx: PluginContext, targetDir: FileSystemDirectoryHandle): Promise<ScanResult>;

  // Опциональные: кэш и сессия
  saveCache?(ctx: PluginContext): Promise<void>;
  cancelBackgroundScan?(): void;
  isScanning?(): boolean;

  // Опциональные: работа с текстовыми файлами (для Логий)
  getTextFiles?(ctx: PluginContext, folderId: FolderId): Promise<TextFileRef[]>;
  writeTextFile?(ctx: PluginContext, remotePath: string, content: string): Promise<{ modified: string | null }>;
  readTextFile?(ctx: PluginContext, remotePath: string): Promise<{ content: string; modified: string | null } | null>;

  // Опциональные: метаданные
  fetchMetadata?(artist: string, title: string): Promise<FetchedMetadata | null>;
  applyCandidate?(trackId: TrackId, extMetadata: Record<string, unknown>): void | Promise<void>;

  // Опциональные: поиск в каталоге (стриминг)
  searchTracks?(query: string): Promise<SearchCandidate[]>;
  fetchAudioBlob?(candidate: SearchCandidate): Promise<Blob | null>;

  // Опциональные: авторизация
  handleAuthCallback?(): Promise<boolean>;
  buildFileUrl?(ctx: PluginContext, remotePath: string): Promise<string | null>;
}
```

`restoreFromCache` — **обязательный** (в отличие от более ранней версии документации). `isDisconnected` — опциональный, ядро использует его для фильтрации провайдеров и источников.

`handleAuthCallback()` — ядро опрашивает плагины по очереди на `/?auth=ok`; первый, вернувший `true`, применяет состояние подключения. Метод должен быть идемпотентным и дешёвым.

## Контракт PluginManifest

```ts
interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly canDownload: boolean;
  readonly entry: () => Promise<{ default: LibrarySource }>;

  // Порядок и приоритеты
  readonly order?: number;
  readonly sourcePriority?: number;
  readonly metadataPriority?: number;

  // Флаги
  readonly isLiveStream?: boolean;
  readonly isStreaming?: boolean;
  readonly contentKind?: 'music' | 'linear';
  readonly isStateless?: boolean;
  readonly requiresActivation?: boolean;
  readonly activationCode?: string;

  // UI
  readonly customRoute?: string;
  readonly extension?: () => Promise<{ default: PluginExtension }>;
  readonly getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
  readonly runSettingsAction?: (actionId: string, payload?: unknown) => void | Promise<void>;

  // Данные
  readonly options?: { emptyStateMessage?: string };
  readonly hasCustomData?: () => boolean | Promise<boolean>;
  readonly clearData?: () => void | Promise<void>;
  readonly backup?: { localStorageKeys?: string[]; idbKeys?: string[] };
}
```

`metadataPriority !== undefined` — плагин участвует в автопоиске метаданных (при условии, что он в `uiSettings.metadataProviderOrder` и включён).

`runSettingsAction` — в **manifest**, не в extension. `extensions.ts` берёт его из манифеста.

## Контракт PluginExtension

```ts
interface PluginExtension {
  menuItems?: PluginMenuItem[]; // пункт меню в боковой панели
  routes?: RouteRecordRaw[]; // кастомные маршруты
  getSettings?: () => PluginSettingsSchema | Promise<PluginSettingsSchema>;
  collectionActions?: PluginCollectionAction[]; // действия над треками
  folderViews?: PluginFolderView[]; // кастомные views для папок
  folderActions?: PluginFolderAction[]; // действия в шапке папки
}
```

`PluginExtension` **не содержит** `runSettingsAction` — он берётся из `PluginManifest`.

### PluginCollectionAction

```ts
interface PluginCollectionAction {
  id: string;
  label: string;
  icon?: IconName;
  tooltip?: string;
  shouldShow: (tracks: Track[]) => boolean | Promise<boolean>;
  run: (tracks: Track[], ctx: CollectionActionContext) => void | Promise<void>;
}

interface CollectionActionContext {
  setProgress: (progress: CollectionActionProgress | null) => void;
}
```

### PluginFolderView

```ts
interface PluginFolderView {
  pluginId: string;
  match: (urlPath: string) => boolean;
  component: () => Promise<{ default: Component }>;
  props?: (urlPath: string) => Record<string, unknown>;
}
```

### PluginFolderAction

```ts
interface PluginFolderAction {
  id: string;
  label: string;
  icon?: IconName;
  tooltip?: string;
  shouldShow: (folder: FolderRef) => boolean;
  run: (ctx: FolderActionContext) => Promise<FolderActionResult>;
}

type FolderActionResult = { kind: 'noop' } | { kind: 'navigate'; pluginId: string; urlPath: string };
```

## PluginContext (инструменты плагина)

```ts
interface PluginContext {
  writer: LibraryWriter; // запись в библиотеку
  showModal<T>(options: ModalOptions): Promise<T>;
  showToast(message: string, type?: 'info' | 'success' | 'error'): void;
  readonly storage: PluginStorage; // idb-keyval с префиксом plugin:<pluginId>:
  getDownloadDir(): Promise<FileSystemDirectoryHandle | null>;
}
```

**`writer` инжектится через `contextDeps`** (`src/plugins/contextDeps.ts`). `plugins/context.ts` не импортирует `stores/library` напрямую — это разрывает рантайм-цикл. Инициализация deps — в `main.ts` (composition root), до bootstrap. При неинициализированном deps `getPluginContextDeps()` бросает.

`getDownloadDir` — обёртка над `downloadSpaceService.getPluginDir(pluginId)`, возвращает `null`, если папка не выбрана.

### PluginStorage

```ts
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>; // удаляет только ключи плагина (по префиксу)
}
```

Ключи: `plugin:<pluginId>:<key>` в idb-keyval. `clear()` использует `keys()` из idb-keyval и удаляет только свои ключи (не весь store).

### ModalOptions

```ts
interface ModalOptions {
  title: string;
  message?: string;
  type: 'input' | 'confirm' | 'custom';
  inputType?: 'text' | 'password';
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  component?: Component;
  props?: Record<string, unknown>;
  disableBackdropClose?: boolean;
}
```

## Таблица плагинов

| ID            | Название        | Стриминг | Скачивание | Маршрут                       | Order | Метаданные |
| ------------- | --------------- | -------- | ---------- | ----------------------------- | ----- | ---------- |
| `local`       | Локальная папка | Нет      | Нет        | Нет                           | 0     | 10         |
| `radio`       | Онлайн-Радио    | Да       | Нет        | `/radio`                      | 10    | Нет        |
| `podcasts`    | Подкасты        | Да       | Да         | `/podcasts`                   | 20    | Нет        |
| `yandexDisk`  | Яндекс.Диск     | Нет      | Да         | Нет                           | 30    | 20         |
| `zvuk`        | СберЗвук        | Да       | Нет        | `/zvuk`                       | 40    | 30         |
| `yandex-self` | Логии           | Нет      | Да         | `/folder/yandex-self/logii.*` | 100   | Нет        |

### Особенности плагинов

- **radio** — каталог станций Radio Browser. `isLiveStream: true`, `isStateless: true`. Станции сохраняются в localStorage.
- **podcasts** — каталог Apple Podcasts. `contentKind: 'linear'`. Подписки сохраняются в IndexedDB.
- **yandexDisk** — сканирование папок на Яндекс.Диске через прокси-сервер. Background scan с прогрессом, force-scan, скачивание на диск. Может сам вызывать `writer.setLibrary` (тогда `snapshot.alreadyApplied = true`).
- **zvuk** — каталог СберЗвук (поиск + стриминг). Треки не сохраняются в библиотеке, но можно искать недоступные треки через `collectionActions`. `fetchMetadata` + `applyCandidate` (добавляет streaming-source).
- **yandex-self** — приватный плагин с активацией по коду (`logii`). Кастомный LogiiView (3 колонки), работа с `.txt` файлами (vibe), чаты. Может сам вызывать `writer.setLibrary`.

## Реестр и lookup

### `src/plugins/registry.ts`

- `getPlugins(): PluginManifest[]` — сортировка по `order` (default 999), затем по `name` (locale `ru`).
- `hasPlugin(id)`, `loadPlugin(id)`, `resetPlugin(id)`.
- `pluginIdFromSource(source)` — отсекает `:`-суффикс.
- `isPluginDisconnected(pluginId)`, `setPluginDisconnected(pluginId, value)` — реактивный кэш (`disconnectedVersion` ref).
- `pluginCanDownload(source)`, `isLiveStream(pluginId)`, `getContentKind(pluginId)`, `isLinearContent(pluginId)`, `isStreamingPlugin(pluginId)`.
- `isPluginActivated(id)` — `true`, если `!requiresActivation` или `localStorage['plugin-activated:' + id] === 'true'`.
- `activatePluginByCode(code)` — перебирает `requiresActivation`-плагины, сверяет `activationCode`, пишет `plugin-activated:<id>`. Возвращает id или `null`.

Манифесты загружаются через `import.meta.glob('./*/manifest.ts', { eager: true })`. Плагин с `enabled: false` не регистрируется.

### `src/plugins/lookup.ts`

- `getPluginManifest(id)` — находит манифест по чистому id или source (`local:Music` → `local`).
- `getPluginName(id, fallback = '<unknown_source>')`.

### `src/plugins/extensions.ts`

- `loadExtensions()` — асинхронно грузит `manifest.extension()` для каждого плагина.
- `getExtensionMenuItems()`, `getExtensionRoutes()`, `getCollectionActions()`, `getExtensionFolderViews()`, `getExtensionFolderActions()`, `findFolderView(pluginId, urlPath)`.
- `getAllSettingsSchemas(): Promise<PluginSettingsEntry[]>` — **async**, фильтрует по `requiresActivation && !isPluginActivated`. `PluginSettingsEntry = { manifest, schema, runAction }`.
- `clearExtensions()`.

`getSettings` берётся из `extension.getSettings ?? manifest.getSettings`.

### `src/plugins/searchStreams.ts`

- `searchStreams(query): Promise<SearchStreamsResult[]>` — опрашивает все плагины с `isStreaming: true` (и активированные). Ошибка одного не прерывает остальных.
- `fetchCandidateAudio(candidate): Promise<Blob | null>` — через `plugin.fetchAudioBlob`. Бросает, если плагин не реализует.
- `candidateFileName(candidate, takenNames)` — санитизация + дедуп, формат `"{artist} - {title}.mp3"`.

### `src/plugins/context.ts` + `contextDeps.ts`

- `createPluginContext(pluginId)` — кэшируется в `Map`.
- `resetPluginContext(pluginId)`, `resetAllPluginContexts()`.
- `setPluginContextDeps(deps)` — вызывается из `main.ts` (composition root).
- `getPluginContextDeps()` — бросает, если deps не инициализирован.

## Жизненный цикл плагина

1. **Registration** (build time): `import.meta.glob('./*/manifest.ts', { eager: true })` загружает все манифесты.
2. **Loading** (runtime): `loadPlugin(id)` делает `manifest.entry()` → получает `LibrarySource`, кэширует.
3. **Restore** (bootstrap): `plugin.restoreFromCache(context)` → если snapshot, `writer.setLibrary`. Иначе — `plugin.load(context)` → `writer.setLibrary` (с проверкой `alreadyApplied`).
4. **Connecting**: `source.connect(context)` (через `connectPlugin` или UI).
5. **Scanning**: `source.scanFolder(context, folderId, options)` (опционально).
6. **Disconnecting**: `source.disconnect(context)`.
