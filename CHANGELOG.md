# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).
Версионирование: [SemVer](https://semver.org/lang/ru/).

## [0.3.2] - wip

### Security

- **`AUTH_SECRET`** — при `NODE_ENV=production` сервер падает с понятной ошибкой,
  если секрет не задан. Раньше использовался `'insecure-default-change-me'`,
  что делало токены подделываемыми.
- **`validateToken`** — сравнение подписей через `crypto.timingSafeEqual`
  вместо `!==`. Устраняет теоретическую утечку длины совпадающего префикса.
- **`express.json({ limit: '1mb' })`** — было `'100mb'`, что открывало DoS-вектор
  через большой JSON-body. Ни одному эндпоинту 100 МБ не нужны.

### Fixed

- **Shuffle при запуске папки / плейлиста / альбома.** Включённый shuffle не влиял
  на `setQueue` — играл первый трек. Дизлайкнутые треки тоже не пропускались.
  Теперь при shuffle очередь перемешивается (Fisher-Yates), играет первый
  не-дизлайкнутый. Без shuffle — играет с `startIndex`, пропуская дизлайкнутые.
- **`toggleShuffle` во время воспроизведения.** При включении shuffle очередь
  не перестраивалась. Теперь перемешиваются оставшиеся треки (после текущего),
  проигранные не трогаются.
- **`next` / `prev` при shuffle.** Убран `pickRandomNonDislikedIndex` — при
  перемешанной очереди случайность была двойной (случайный порядок + случайный
  выбор следующего). Теперь обход линейный; при достижении конца очереди
  очередь перемешивается заново и играет с первого не-дизлайкнутого.
- **Дизлайки не сохранялись при перезагрузке.** `dislikes.restore()` не
  вызывался при старте приложения — данные писались в IDB, но не читались
  обратно при F5.
- **Кэш метаданных** — при обеих упавших внешних API (`iTunes` + `Deezer`)
  пустой результат больше не кэшируется на 24 часа. Теперь кэш пишется только
  если хотя бы один источник ответил успешно.
- **Кэш настроек** — после `PUT /api/disk/text` на `.settings.json` кэш
  инвалидируется. Раньше изменения не применялись 5 минут.

### Changed

- **`player.ts`** — упрощены `hasNext` / `hasPrev` (shuffle = «есть ещё
  треки, кроме текущего»). Добавлены `shuffleArray` (Fisher-Yates) и
  `findNonDislikedIndexFrom`.
  - **Дебаунс сохранения в сторах** — `playlists`, `history`, `dislikes` и
    `uiSettings` теперь сохраняют в IDB с задержкой 300–500 мс. Раньше запись
    происходила на каждое изменение (например, при быстром добавлении треков
    в плейлист или передвижении ползунка порога). Добавлены методы `flush()`
    и вызовы в `beforeunload` / `visibilitychange`.
- **`dominantColor` cache** — теперь LRU с лимитом 200 записей. Раньше кэш
  рос неограниченно.
- **`useDominantColor`** — обёрнут `extractDominantColor` в `try/catch`;
  при ошибке сбрасывается в `FALLBACK_RGB`, а не оставляет старый цвет.
- **`MetadataPersistenceService.get`** — при чтении истёкшей записи «не найдено»
  она удаляется из памяти, а не возвращается пустой.

### Added

- **`flush()`** в `playlists` / `history` / `dislikes` / `uiSettings` —
  для синхронизации при `beforeunload`.

## [0.3.1] — 2026-10-04

### Added

- **`normalizeClientPath`** (`server/src/disk/normalize.js`) — нейтральный
  модуль нормализации клиентских путей: убирает префикс `disk:`, схлопывает
  `.` и `..`, не даёт выйти выше корня.
- **Negative cache в `loadSettings`** — при ошибке загрузки (сеть, 5xx)
  настройки не запрашиваются повторно 30 секунд.
- **`isSettingsPath(clientPath)`** — определяет, указывает ли путь на
  `.settings.json`. Заготовка под сброс кэша после `PUT /api/disk/text`.
- **Тесты на сервере** — `vitest` с проектами (`frontend` / `server`)
  в корневом `vitest.config.ts`. Спек-файлы:
  `normalize`, `paths`, `settings/client`, `metadata/similarity`,
  `auth/jwt`, `disk/filter`.
- **`fuzzball`** — token-based метрики для сравнения метаданных.
- **`safeTokenSetRatio` / `safeTokenSortRatio`** — обёртки над `fuzzball`,
  отсекают шум Levenshtein на строках без общих токенов.

### Changed

- **`resolveDiskPath`** — нормализует `..`, закрывая path traversal.
  Раньше `/nostalgy/../../../secret` выводил за пределы корня музыки,
  обходя `isPathPublic`.
- **`isPathPublic`** — нормализует входной путь через `normalizeClientPath`
  и разрешает доступ к родителю публичной папки. Раньше пользователь не мог
  дойти до публичной папки сверху вниз, если родитель не был публичен.
- **`metadataSimilarity`** — переписана с Jaro-Winkler на token-based:
  - artist и title сравниваются раздельно;
  - веса `0.8 / 0.2` в пользу title;
  - если artist явно разный — вклад обнуляется, к title применяется штраф `0.5`;
  - транслит RU→EN применяется к обоим полям.
    Jaro-Winkler на конкатенации artist+title давал ~0.43 на строках без общих
    символов и ~0.49 для разных языков, из-за чего мусорные кандидаты
    проходили фильтр.
- **`vitest.config.ts`** — переписан без `mergeConfig` с `vite.config.ts`,
  с явной конфигурацией проектов `frontend` (jsdom) и `server` (node).
- **`server/package.json`** — добавлена зависимость `fuzzball`.
- **`server/src/metadata/jaroWinkler.js`** — оставлен как reference
  (не используется в активной метрике).

### Fixed

- **Path traversal** в `resolveDiskPath` и `isPathPublic`.
- **Шум метаданных** — `Radiohead` vs `Иван Кучин` больше не даёт 0.49.

### Removed

- **`src/metadata/jaroWinkler.js`** — перемещён в
  `server/src/metadata/jaroWinkler.js` (только в серверной части).

### Планируется

- `AUTH_SECRET` — падать при `NODE_ENV=production` без явного секрета.
- `express.json({ limit: '100mb' })` → 1mb (DoS-вектор).
- `metadata/routes.js` — не кэшировать пустой результат, если обе внешние API упали.
- `disk/routes.js` — вызывать `invalidateSettingsCache()` после `PUT /text`
  на `.settings.json`.
- Разнобой `.js` / `.ts` в комментариях `server/src/` — артефакты, привести к `.js`.

## [0.3.0] — 2026-10-03

### Added

- `TrackRow` — общая база для `TrackListItem` / `QueueTrackRow` / `TrackResolvedItem`.
- `BatchDownloadButton` — единая кнопка для папок и плейлистов.
- `MetadataApplier` — единый сервис применения метаданных.
- `MetadataFetchResult` — discriminated union в `TrackMetadataService`.
- `DropdownMenu` + `useMenu`.
- `menu.ts` + `AppDrawer` + `getPageTitle`.
- `pluginCanDownload()` и `manifest.canDownload`.
- `pluralize()`.
- `FolderBreadcrumbs`.
- Параллельный обход подпапок в `refreshSubtree`.
- `FolderStatus` в `FolderList`.

### Changed

- Все SVG — в компонентах.
- `FolderView` перемещён в `src/views/`.
- `recalcUpwards` — переписан алгоритм пересчёта счётчиков.
- `addTracks` / `updateFolder` — вызывают `recalcUpwards`.
- `setLibrary` / `removeBySource` / `removeFolders` — сброс `currentFolderId` при удалении.
- Яндекс.Диск: разделены `sourceId` и `folderId`.
- `SCHEMA_VERSION = 3`.
- `useMediaSession` — `immediate: true`.
- `useKeyboardShortcuts` — блокировка при открытой модалке.
- `normalizeUmlauts` — сохраняет регистр.
- `FullPlayer` — анимация перенесена в `App.vue`.
- `TrackRow.track` — тип `Track | LibraryTrack`.
- README актуализирован.
- Версии: фронт `0.3.0`, сервер `0.3.0`.

### Fixed

- `.app-safe-bottom` использовал `safe-area-inset-top`.
- `BatchDownloadButton` показывался в локальной папке.
- Дубликат тостов при подключении Яндекс.Диска.
- Сортировка в `recalcUpwards` (листья → корни).
- Мёртвые импорты и символы по проекту.
- `vue/multi-word-component-names` — `Breadcrumbs` → `FolderBreadcrumbs`.
- `vue/require-toggle-inside-transition` — `Transition` без `v-if` в `FullPlayer`.

### Removed

- `useDownloadOrchestrator.ts`.
- `FolderDownloadButton.vue`.
- `PlaylistDownloadButton.vue`.
- `LocalSettings.vue`.
- Пустой `src/plugins/local/collect.ts`.

## [0.2.2] — предыдущий релиз

Без формального changelog. Вехи: плагинная архитектура источников, локальная
библиотека + Яндекс.Диск, плеер с очередью и Media Session, плейлисты, история,
избранное, дизлайки, метаданные (iTunes + Deezer), PWA, мобильная адаптация.
