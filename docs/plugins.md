# Плагины

## Контракт LibrarySource

```ts
interface LibrarySource {
  // Обязательные методы
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  isAvailable(): boolean;
  connect(context: PluginContext): Promise<void>;
  load(context: PluginContext, options?: LoadOptions): Promise<PluginSnapshot>;
  disconnect(context: PluginContext): Promise<void>;
  buildStreamUrl(source: TrackSource): string;
  readonly canDownload: boolean;

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
  restoreFromCache?(ctx: PluginContext): Promise<PluginSnapshot | null>;
  checkSession?(): Promise<'ok' | 'expired' | 'unavailable'>;
  markDisconnected?(): void;
  cancelBackgroundScan?(): void;
  isScanning?(): boolean;

  // Опциональные: работа с текстовыми файлами (для Логий)
  getTextFiles?(ctx: PluginContext, folderId: FolderId): Promise<TextFileRef[]>;
  writeTextFile?(ctx: PluginContext, remotePath: string, content: string): Promise<{ modified: string | null }>;
  readTextFile?(ctx: PluginContext, remotePath: string): Promise<{ content: string; modified: string | null } | null>;

  // Опциональные: метаданные
  fetchMetadata?(artist: string, title: string): Promise<FetchedMetadata | null>;
  applyCandidate?(trackId: TrackId, extMetadata: Record<string, unknown>): void | Promise<void>;

  // Опциональные: авторизация
  handleAuthCallback?(): Promise<boolean>;
  buildFileUrl?(ctx: PluginContext, remotePath: string): Promise<string | null>;
}
```

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
  readonly sourcePriority?: number; // приоритет в библиотеке
  readonly metadataPriority?: number; // приоритет в автопоиске метаданных

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

## Контракт PluginExtension

```ts
interface PluginExtension {
  menuItems?: PluginMenuItem[]; // пункт меню в боковой панели
  routes?: RouteRecordRaw[]; // кастомные маршруты
  getSettings?: () => PluginSettingsSchema; // настройки плагина
  collectionActions?: PluginCollectionAction[]; // действия над треками
  folderViews?: PluginFolderView[]; // кастомные views для папок
  folderActions?: PluginFolderAction[]; // действия в шапке папки
}
```

## PluginContext (инструменты плагина)

```ts
interface PluginContext {
  writer: LibraryWriter; // запись в библиотеку
  showModal<T>(options: ModalOptions): Promise<T>; // модальные окна
  showToast(message: string, type?: 'info' | 'success' | 'error'): void; // тосты
  readonly storage: PluginStorage; // localStorage + IndexedDB
  getDownloadDir(): Promise<FileSystemDirectoryHandle | null>;
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
- **yandexDisk** — сканирование папок на Яндекс.Диске через прокси-сервер. Background scan с прогрессом, force-scan, скачивание на диск.
- **zvuk** — каталог СберЗвук (поиск + стриминг). Треки не сохраняются в библиотеке, но можно искать недоступные треки через `collectionActions`.
- **yandex-self** — приватный плагин с активацией по коду (`logii`). Кастомный LogiiView (3 колонки), работа с `.txt` файлами (vibe), чаты.

## Жизненный цикл плагина

1. **Registration** (build time): `import.meta.glob` загружает все `manifest.ts` из `src/plugins/*/`
2. **Loading** (runtime): `loadPlugin(id)` делает `manifest.entry()` → получает `LibrarySource`
3. **Connecting**: `source.connect(context)` → OAuth или авторизация
4. **Loading data**: `source.load(context)` → `PluginSnapshot` → `writer.setLibrary()`
5. **Restoring**: `source.restoreFromCache()` → кэш в IndexedDB (если сеть недоступна)

## Расширения плагинов

`loadExtensions()` (вызывается при старте) собирает UI-расширения из всех плагинов:

- `getExtensionMenuItems()` → боковое меню
- `getExtensionRoutes()` → динамические маршруты
- `getExtensionFolderViews()` → кастомные views для папок
- `getCollectionActions()` → действия над треками
- `getExtensionFolderActions()` → кнопки в шапке папки
- `getAllSettingsSchemas()` → настройки плагина
