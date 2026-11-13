# Соглашения проекта

## Типы и ID

- Все ID — UUID v4 (кроме системных констант: `collection:history`, `collection:dislikes`, `playlist:favorites`).
- Все ID-типы — branded types (`TrackId`, `AlbumId`, `FolderId`, `TrackSourceId`, `PlaylistId`).
- Для создания ID используются фабрики: `newTrackId()`, `newAlbumId()`, `newFolderId()`, `newPlaylistId()`, `newSourceId()` из `src/types/ids.ts`.
- `any` запрещён — используется строгая типизация. Для unknown-структур — `Record<string, unknown>`.

## Реляционная модель

- Связи только через ID: `Track.albumId`, `Track.sources[].folderId`, `Folder.parentId`.
- Никаких вложенных массивов сущностей (нет `folder.tracks[]` — только `folder.trackIds[]`).
- Один трек может иметь несколько источников (`Track.sources[]`).
- `Track.pluginId` — плагин первого (приоритетного) источника, для UI-удобства.

## Архитектура

- Ядро не знает о конкретных плагинах — только контракты `LibrarySource`, `PluginManifest`, `PluginExtension`.
- Единственная точка записи в библиотеку — `LibraryWriter`.
- Единственная точка изменения метаданных — `MetadataService`.
- Кросс-стор уведомления — через `eventBus` (типизированный pub/sub), не через импорты сторов.
- Плагины регистрируются автоматически через `import.meta.glob('./*/manifest.ts')`.

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

## Хранение

| Тип данных             | Хранилище    | Ключ                                                            |
| ---------------------- | ------------ | --------------------------------------------------------------- |
| Библиотека             | IndexedDB    | `library`                                                       |
| Плейлисты              | IndexedDB    | `playlists`                                                     |
| История                | IndexedDB    | `history`                                                       |
| Дизлайки               | IndexedDB    | `dislikes`                                                      |
| Состояние плеера       | IndexedDB    | `player-state`, `player-playback`                               |
| Метаданные (overrides) | IndexedDB    | `metadata-overrides`                                            |
| UI настройки           | localStorage | `cuei:ui-settings`                                              |
| Статус плагинов        | localStorage | `yandex-connected`, `yandex-disconnected`, `plugin-activated:*` |
| Файловые handles       | IndexedDB    | `download-dir-handle`, `local-folder-handle`                    |

## API клиент

- `ApiClient` — singleton, базовый URL из env.
- `AuthProvider` — интерфейс для получения токена (реализация в `AuthService`).
- Все сетевые запросы — через `ApiClient`, не через `fetch` напрямую.
- Ошибки — типизированные `ApiError` со статусом и сообщением.

## Тесты

- Юнит-тесты: `vitest`, файлы `<Name>.spec.ts` рядом с модулем.
- E2E: Playwright, папка `e2e/`.
- В тестах только локаторы `data-testid`.
- Никаких `page.waitForTimeout`.
- Partial-mock: `vi.mock(path, importOriginal)` с переопределением только нужного метода.
- Никаких проверок точных строк тостов и лейблов — только поведение.

## Релизы

- Версия в `package.json` semver.
- Changelog: `changelog/<номер>.md` для каждого релиза + сводный `CHANGELOG.md`.
- Структура проекта обновляется через `yarn tree-generate` → `docs/STRUCTURE.md`.
- AST-манифест документации: `yarn docs:manifest` → `docs/.manifest.json`.
