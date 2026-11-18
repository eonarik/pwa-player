# Соглашения проекта

## Типы и ID

- Все ID — UUID v4 (кроме системных констант: `collection:history`, `collection:dislikes`, `playlist:favorites`).
- Все ID-типы — branded types (`TrackId`, `AlbumId`, `FolderId`, `TrackSourceId`, `PlaylistId`, `MetadataCandidateId`).
- Для создания ID используются фабрики: `newTrackId()`, `newAlbumId()`, `newFolderId()`, `newPlaylistId()`, `newSourceId()`, `newMetadataCandidateId()` из `src/types/ids.ts`.
- `any` запрещён — используется строгая типизация. Для unknown-структур — `Record<string, unknown>`.

## Реляционная модель

- Связи только через ID: `Track.albumId`, `Track.sources[].folderId`, `Folder.parentId`.
- Никаких вложенных массивов сущностей (нет `folder.tracks[]` — только `folder.trackIds[]`).
- Один трек может иметь несколько источников (`Track.sources[]`).
- `Track.pluginId` — **производное** поле. Пересчитывается `LibraryWriter` из `sources[0].pluginId` (после сортировки по `priority`). При пустых sources — `''`. Прямая запись запрещена.
- `Track.duplicateTrackIds` — симметричные связи с треками-дубликатами в библиотеке (не внешние кандидаты). Заполняется при soft-match, очищается после `applyDuplicates`.
- `albumId` и `coverUrl` взаимоисключающи по смыслу: если `albumId !== null`, обложка на `Album.coverUrl`, `Track.coverUrl = null`. Иначе — обложка на треке.

## Архитектура

- Ядро не знает о конкретных плагинах — только контракты `LibrarySource`, `PluginManifest`, `PluginExtension`.
- Единственная точка записи в библиотеку — `LibraryWriter` (контракт в `src/services/library/LibraryWriter.ts`, реализация в `src/stores/library/writer/`).
- Единственная точка изменения метаданных — `MetadataService`.
- Кросс-стор уведомления — через `eventBus` (типизированный pub/sub). Полный список событий: `track:metadata-updated`, `download:space-selected`.
- Плагины регистрируются автоматически через `import.meta.glob('./*/manifest.ts', { eager: true })`.
- `PluginContext` получает `writer` через `contextDeps` (DI), а не прямым импортом `stores/library`.

### Исключения из правила «кросс-стор через eventBus»

Следующие места **напрямую импортируют** сторы (осознанные исключения, зафиксированы):

- `src/stores/library/writer/index.ts` → `useUiSettingsStore` (для `playlistMatchThreshold` в `mergeMany`).
- `src/services/metadata/MetadataService/apply/merge.ts` → `usePlaylistsStore`, `useHistoryStore`, `useDislikesStore` (перевешивание trackId при слиянии дублей).
- `src/stores/player/actions/helpers.ts` → `useDislikesStore` (проверка `isDisliked`).

При добавлении нового кросс-стор взаимодействия — по умолчанию через `eventBus`, прямое исключение — только с фиксацией здесь.

## UI-слои

- `src/components/atoms/` — прокидывают только props/slot, без сторов/сервисов/плагинов.
- `src/components/molecules/` — композиция атомов, без сторов/сервисов/плагинов.
- `src/components/ui/` — органимы: могут зависеть от сторов и сервисов ядра.
- Границы держит линтер (`no-restricted-imports` в `eslint.config.ts`). Подробности: `docs/storybook.md`.

## Структура плагина

```
src/plugins/<plugin-name>/
├── manifest.ts      # экспортирует `manifest: PluginManifest` (обязательный)
├── index.ts         # экспортирует `default: LibrarySource` (обязательный)
├── extension.ts     # экспортирует `default: PluginExtension` (опционально)
├── constants.ts     # PLUGIN_ID, PLUGIN_NAME, PLUGIN_ICON (при необходимости)
├── types.ts         # типы плагина (опционально)
├── <Service>.ts     # внутренняя логика (опционально)
└── *.vue            # компоненты (опционально)
```

## Файлы

- Один файл ≤ 300 строк. При превышении — разбиваем.
- Именование: PascalCase для классов и Vue-компонентов, camelCase для функций и переменных.
- Тесты: `<Name>.spec.ts` рядом с `<Name>.ts`.
- Stories: `<Name>.stories.ts` для UI-компонентов.

## Комментарии

- Без длинного тире и эмодзи.
- На английском языке (если в проекте нет русских комментариев).
- JSDoc для публичных API (интерфейсы, классы, экспортируемые функции).
- Отладочные комментарии не коммитятся.

## Плагины: manifest vs extension

| Манифест                                            | Extension                                         |
| --------------------------------------------------- | ------------------------------------------------- |
| Манифестирует плагин (id, name, флаги, entry point) | Расширяет UI (routes, menu items, views, actions) |
| Всегда загружается при старте                       | Ленивая загрузка (когда UI нужен)                 |
| Знает про `LibrarySource`                           | Знает про Vue-компоненты и роутер                 |
| `runSettingsAction` живёт здесь                     | `getSettings` может быть здесь                    |

## Хранение

| Тип данных                      | Хранилище    | Ключ / механизм                                         |
| ------------------------------- | ------------ | ------------------------------------------------------- |
| Библиотека (tracks, folders)    | IndexedDB    | определяется плагином через `plugin.saveCache(context)` |
| Альбомы                         | IndexedDB    | `player:albums`                                         |
| Плейлисты                       | IndexedDB    | `player:playlists`                                      |
| История                         | IndexedDB    | `player:history`                                        |
| Дизлайки                        | IndexedDB    | `player:dislikes`                                       |
| Состояние плеера                | IndexedDB    | `player:state`, `player:playback`                       |
| Кэш автопоиска метаданных       | IndexedDB    | `player:metadata`                                       |
| Версия схемы                    | IndexedDB    | `player:schemaVersion`                                  |
| UI настройки                    | localStorage | `player:uiSettings`                                     |
| Папка скачивания                | IndexedDB    | `player:downloadSpace`                                  |
| Данные плагинов (PluginStorage) | IndexedDB    | `plugin:<pluginId>:<key>`                               |
| Статус активации плагина        | localStorage | `plugin-activated:<pluginId>`                           |
| Legacy-ключ метаданных Zvuk     | localStorage | `zvuk:fetchMetadata` (удаляется при миграции)           |

### Снятие реактивных Proxy перед записью в IDB

Единого правила нет, используются три подхода:

- `AlbumService` — `deepToRaw` + `structuredClone`.
- `PlaylistPersistenceService` — `JSON.parse(JSON.stringify(p))` в `usePlaylistsStore.save()`.
- `History`/`Dislikes` — plain-объекты из `Object.entries` (Proxy нет).

Перед записью в IDB реактивные Proxy должны быть сняты. Способ — на усмотрение сервиса, но должен быть.

### Миграции

- `SchemaService.ensureCompatible()` — при смене `SCHEMA_VERSION` **`clear()` всего IDB** (wipe, не миграция). Отдельных миграций нет.
- Legacy-ключи удаляются точечно через `migrations.ts` (например, `consumeLegacyMetadataToggle()` для `zvuk:fetchMetadata`).
- При несовместимом изменении — bump `SCHEMA_VERSION`, данные теряются.

## API клиент

- `ApiClient` — singleton, базовый URL из env.
- `AuthProvider` — интерфейс для получения токена (реализация в `AuthService`).
- Все сетевые запросы — через `ApiClient`, не через `fetch` напрямую.
- Ошибки — типизированные `ApiError` (`status`, `message`) и `AuthError` (`providerId`, `reason: 'refresh-expired' | 'no-refresh-token' | ...`).
- `AuthError` бросается из `apiClient.ensureAuth(pluginId)` при истёкшей сессии. `usePlayerStore.playAt` ловит, вызывает `handleAuthError`, пробует следующий source.

## Тесты

- Юнит-тесты: `vitest`, файлы `<Name>.spec.ts` рядом с модулем.
- E2E: Playwright, папка `e2e/`.
- В тестах только локаторы `data-testid`.
- Никаких `page.waitForTimeout`.
- Partial-mock: `vi.mock(path, importOriginal)` с переопределением только нужного метода.
- Никаких проверок точных строк тостов и лейблов — только поведение.
- Для тестов, которым нужен «секретный» плагин (активация), id и код берутся из реестра (`findActivatable()`), а не хардкодятся.

## Релизы

- Версия в `package.json` semver.
- Changelog: `changelog/<номер>.md` для каждого релиза + сводный `CHANGELOG.md`. Патч-релизы кладутся в файл минорной версии (0.19.2 → `changelog/0.19.md`), отдельных файлов для патчей не создаем.
- Структура проекта обновляется через `yarn tree-generate` → `docs/STRUCTURE.md`.
- AST-манифест документации: `yarn docs:manifest` → `docs/.manifest.json`.
