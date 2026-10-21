# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).
Версионирование: [SemVer](https://semver.org/lang/ru/).

## [0.8.0] — 2026-10-21

### Added

- **Плагин «Онлайн-Радио» (`radio`)** — каталог интернет-станций через Radio Browser API. Отдельный роут `/radio`, доступен из главного экрана.
- **«Мои станции»** — сохранение избранных станций в `localStorage` (`radio:saved-stations`). Воспроизведение, удаление, индикатор играющей станции.
- **Каталог станций** — поиск по названию, фильтры по стране и тегу, сортировка (топ чарт, голоса, тренды, качество, случайные, алфавит), пагинация по 5/10/15/20/30.
- **Счётчики станций** в фильтрах — у каждой страны и тега показывается общее число станций по данным Radio Browser.
- **Live-режим в плеере** — для потоковых треков (`isLiveStream`) скрыты прогресс-бар, длительность, prev/next, shuffle, repeat; в `FullPlayer` отображается плашка «Live Stream».
- **HLS-поддержка** в `AudioService` — воспроизведение `.m3u8` через `hls.js` (с фолбэком на нативный `<audio>` для Safari/iOS).
- **`PluginManifest.isStateless`** — плагин без подключения и без папок (в `HomeView` всегда «Доступно», кнопка «Очистить» вместо «Отключить»).
- **`PluginManifest.customRoute`** — кнопка «Открыть» в `HomeView` ведёт на кастомный роут, а не в `FolderView`.
- **`PluginManifest.hasCustomData`** — кастомная проверка наличия данных для stateless-плагинов.
- **`PluginManifest.clearData`** — очистка данных stateless-плагина из `HomeView`.
- **`PluginManifest.isLiveStream`** — ядро скрывает длительность, прогресс, метаданные и кнопки скачивания для потоковых источников.

### Changed

- `RadioService` возвращает `{ stations, total }` из `getTopStations`: `total` — сырое количество до HTTPS-фильтрации, для корректной пагинации «Вперёд».
- `RadioService.getCountries` / `getTags` различают ошибку (`null`) и пустой успешный ответ (`[]`). В UI это разные состояния: «Ошибка загрузки» с кнопкой «Повторить» vs пустой список.
- `RadioService.getTopStations` запрашивает `limit * 3` и фильтрует по `https://`, чтобы после фильтрации осталось достаточно станций. HTTPS-фильтр снова активен (был закомментирован).
- `RadioService.getTags` возвращает `{ name, stationCount }[]` вместо `string[]`.
- `RadioView` — фильтр по тегам реактивен (`watch` с `deep: true`).
- `AudioService.seek` / `seekBy` — no-op для live-потоков (`duration === Infinity`). Раньше `seek(0)` перезапускал поток.
- `player.next` / `player.prev` — no-op для live-треков. Раньше перезапускали станцию.
- `player` не записывает live-треки в историю воспроизведения (запись была бы «мёртвой» — из истории радио не заиграть).
- `RadioView.playStation` — `artist` теперь пустой, а не «Онлайн-радио» (в `FullPlayer` не показывается фиктивный артист).
- `RadioView` — «Ничего не найдено» показывается, когда список пуст и загрузка завершена (раньше мог остаться вечный лоадер).

### Fixed

- **Зависание списка станций в лоадере** — `RadioView` ждал `{ stations, total }`, а `RadioService.getTopStations` возвращал массив. `topStations` становился `undefined`, `v-for` рендерил пустоту.
- **Пагинация «Вперёд» не работала** — `hasMore` считался по `result.total`, которого не было.
- **Фильтр по тегам не применялся** — `watch` по `topTags` не срабатывал на мутацию массива (`push`/`splice`).
- **Страны не появлялись после «Повторить»** — `getCountries` возвращал `[]` и на ошибку, и на пустой ответ; UI не различал состояния.
- **Live-поток перезапускался** при `seek`/`next`/`prev` (в т.ч. через Media Session и хоткеи) — теперь no-op.

### Removed

- `TrackActions`: для live-треков скрыты «Найти метаданные» и «Скачать» (через `isLiveStream`).
- `FullPlayer`: для live-треков скрыты prev/next, shuffle, repeat, прогресс-бар заменён на плашку «Live Stream».

## [0.7.0] — 2026-10-22

### Added

- **Умный матчинг плейлистов**: при импорте (M3U/JSON) треки теперь сопоставляются с библиотекой с помощью fuzzy-алгоритма (Jaro-Winkler). Теперь `30 Seconds to Mars` и `30 Second To Mars` успешно склеиваются.
- **Автоматическое пересопоставление**: если плейлист был импортирован без источника (треки висели как «неизвестные»), при заходе в плейлист плеер попытается найти их в библиотеке заново (если источник уже подключён).
- **Настройка порога импорта**: в настройках (вкладка «Общие») появился ползунок «Порог совпадения» для импорта плейлистов (по умолчанию 0.8).
- `PlaylistMatcher` — изолированный сервис для поиска совпадений по `artist` + `title`.
- `TrackResolvedItem`: теперь при недоступности источника отображается зачеркнутое название трека (`Artist - Title`), а не безликое «Источник недоступен».

### Changed

- `uiSettings`: добавлено поле `playlistMatchThreshold`.
- `PlaylistsView`: при импорте выводится детальная статистика (`точно: N, примерное: M, не найдено: K`).

### Fixed

- `TrackResolvedItem`: исправлено отображение треков без источника (теперь передается `snapshot` из плейлиста/истории/дизлайков).

## [0.6.0] — 2026-10-22

### Added

- **Экспорт плейлистов**: поддержка форматов **M3U** (для VLC, MusicBee) и **JSON** (нативный формат CUEI с метаданными).
- **Импорт плейлистов**: чтение файлов `.m3u` и `.json`.
- Утилита `playlistParser.ts` для парсинга и генерации плейлистов.
- Кнопка «Поделиться» в `PlaylistRoute` и кнопка «Импортировать» в `PlaylistsView`.

### Changed

- При импорте JSON/M3U треки сопоставляются с текущей библиотекой по точному совпадению `artist` + `title`. Если трек не найден, он добавляется как снимок (заглушка) для последующего матчинга.

### Fixed

- В `YandexDiskService` и `YandexSelfService` убраны `any` при парсинге ответов API.

## [0.5.1] — 2026-10-22

### Added

- **Three-way merge для `.txt` файлов (Логии)**: внедрена библиотека `node-diff3`. Теперь при одновременном редактировании файла с разных устройств правки объединяются автоматически. Если изменения затронули одну и ту же строку — вставляются маркеры конфликта (`<<<<<<<`), как в Git.
- **Табы в `SettingsView`**: настройки разделены на логические разделы («Общие», «Плагины», «Данные», «О приложении») для избавления от бесконечного скролла.
- **Активация скрытых плагинов**: в настройках добавлен скрытый раздел «Секретные функции» (активируется по клику на заголовок), позволяющий включить `yandex-self` по секретному коду.
- `YandexSelfService`: добавлены флаги `isDisconnected` и `isCancelled` для надежного управления состоянием.

### Changed

- `scan.ts`: внедрен флаг `isCancelled`. Фоновые процессы сканирования и записи в IDB теперь мгновенно прерываются при отключении плагина, что решает проблему «возвращающихся» кнопок.
- `createPlugin.ts`: логика отмены вынесена в замыкание, пустой пароль (`""`) теперь корректно отличается от отмены ввода (`null`).

### Fixed

- Ошибка `Cannot read properties of undefined (reading 'tracks')` при прерывании фонового сканирования.
- Баг с невозможностью войти в `yandex-self` без пароля (если в конфиге контекста пароль пустой).
- Пути в `YandexSelfService` (нормализация слэшей и префиксов).

## [0.5.0] — 2026-10-21

### Added

- **Плагин Логии (`yandex-self`)**: приватный источник музыки и `.txt` файлов для ограниченного круга лиц.
- Архитектурный рефакторинг `yandexDisk`: вынесен базовый движок `createYandexPlugin`, который теперь используется обоими плагинами (`yandex` и `yandex-self`).
- `YandexSelfService` — сервис для работы с личным Диском по JWT-токену и контекстам (`ctx`).
- Поддержка контекстов в `.settings.json` (разграничение доступа к папкам для разных людей).
- Система активации скрытых плагинов (через секретный код в настройках).
- `TextEditorModal`: добавлена защита от перезаписи несохранённых данных и конфликтов версий.
- `AutocompleteInput`: исправлена фильтрация (теперь при клике показываются все варианты).
- `FolderList`: добавлено отображение количества вложенных папок.

### Changed

- `ModalService`: рендер кастомных компонентов (возвращён тип `custom`).
- `createPlugin`: авторизация в `yandex-self` теперь всегда запрашивает код (пароль/контекст), если нет валидного токена.
- `scan.ts`: добавлен флаг `isCancelled` для предотвращения гонки данных при отключении плагина.

### Fixed

- Сканирование папок `yandex-self` (добавлено поле `isAudio` при маппинге ответа).
- Воспроизведение треков из `yandex-self` (токен теперь передается в query-параметре для `<audio>`).
- Пути в `YandexSelfService` (нормализация слэшей и префиксов).
- Отображение списка плагинов в `HomeView` (реактивность при отключении).

## [0.4.0] — 2026-10-18

### Security

- **OAuth Яндекс.Диска вместо JWT-пароля.** Токен доступа хранится только в серверной сессии (`express-session` + `memorystore`). В браузере — только `HttpOnly`, `SameSite=Lax` cookie.
- Право `cloud_api:disk.app_folder` — приложение имеет доступ только к папке `app:/` (Приложения / CUEI media player), а не ко всему Диску пользователя.
- Удалён `AUTH_SECRET`, JWT-токены и файл `.settings.json` (перенесены в legacy для плагина Логии).
- `CSRF` защита через `SameSite=Lax` и проверку `Origin`.

### Added

- Модульный монолит на бэкенде: `core/`, `plugins/`, `shared/`, `modules.js`.
- `plugins/yandex` — API для работы с Яндекс.Диском через сессию.
- `plugins/feedback` — обратная связь через `nodemailer` (SMTP Яндекса) с rate limit (1 сообщение в минуту с IP).
- `v-tooltip` — кастомная директива для всплывающих подсказок (вместо нативных `title`).
- `MarkdownText.vue` + `services/markdown` — extensible-рендерер для `emptyStateMessage`.
- `emptyStateMessage` в `manifest.options` — подсказка в пустом корне источника (например, куда кидать музыку на Яндекс.Диске).

### Changed

- **Фронт:** `AuthService` переписан на `me()` / `startOAuth()` / `logout()`. Все запросы к API идут с `credentials: 'include'`.
- `YandexDiskService` больше не использует `?token=`, работает через same-origin (`PROXY_URL = ''`).
- `connect()` в плагине Яндекса делает редирект на OAuth. `HomeView` автоматически подхватывает возврат (`?auth=ok`) и загружает библиотеку без повторного клика.
- `SCHEMA_VERSION = 4` (данные сбрасываются при первом запуске; с 0.4.0 — только миграции).
- Тултипы добавлены на все иконочные кнопки.

### Removed

- `passport-yandex` (заменён на `passport-oauth2` с PKCE S256).
- Legacy-код (`auth/`, `settings/`, `middleware/`, `disk/`, `config/`) перенесён в `server/src/_legacy/` для плагина Логии (0.5.0).

### Fixed

- Сессия не сохранялась при OAuth-редиректе (исправлено через `req.user` и `passport-oauth2`).
- `App has already been mounted` в директиве `v-tooltip`.
- Неверное позиционирование и «прыгающий» тултип при смене текста.

## [0.3.2] — 2026-10-04

### Security

- **`AUTH_SECRET`** — при `NODE_ENV=production` сервер падает с понятной ошибкой,
  если секрет не задан. Раньше использовался `'insecure-default-change-me'`,
  что делало токены подделываемыми.
- **`validateToken`** — сравнение подписей через `crypto.timingSafeEqual`
  вместо `!==`. Устраняет теоретическую утечку длины совпадающего префикса.
- **`express.json({ limit: '1mb' })`** — было `'100mb'`, что открывало DoS-вектор
  через большой JSON-body. Ни одному эндпоинту 100 МБ не нужны.

### Added

- **`flush()`** в `playlists` / `history` / `dislikes` / `uiSettings` —
  для синхронизации при `beforeunload` / `visibilitychange`.
- **`src/services/metadata/constants.ts`** — `UNKNOWN_ARTIST_PLACEHOLDER`
  как единая константа.

### Changed

- **Дебаунс сохранения в сторах** — `playlists`, `history`, `dislikes` и
  `uiSettings` теперь сохраняют в IDB с задержкой 300–500 мс. Раньше запись
  происходила на каждое изменение (например, при быстром добавлении треков
  в плейлист или передвижении ползунка порога). Добавлены `flush()` и вызовы
  в `beforeunload` / `visibilitychange`.
- **`dominantColor` cache** — теперь LRU с лимитом 200 записей.
- **`useDominantColor`** — обёрнут `extractDominantColor` в `try/catch`;
  при ошибке сбрасывается в `FALLBACK_RGB`.
- **`MetadataPersistenceService.get`** — при чтении истёкшей записи «не найдено»
  она удаляется из памяти.
- **`player.ts`** — упрощены `hasNext` / `hasPrev`; добавлены `shuffleArray`
  (Fisher-Yates) и `findNonDislikedIndexFrom`.
- **`UNKNOWN_ARTIST_PLACEHOLDER`** — значение `''` вместо `'Yandex Disk'`.
  Ядро не должно знать о плагинах.
- **`ModalOptions.type`** — убран вариант `'custom'`, который нигде не
  обрабатывался.
- **Prettier** — прогнан `yarn format`; двойные кавычки и `.ts`-расширения
  в импортах приведены к стилю проекта.
- **Комментарии в `server/src/*.js`** — убраны `.ts`-артефакты.

### Fixed

- **Shuffle при запуске папки / плейлиста / альбома.** Включённый shuffle не влиял
  на `setQueue` — играл первый трек. Дизлайкнутые тоже не пропускались.
  Теперь при shuffle очередь перемешивается (Fisher-Yates), играет первый
  не-дизлайкнутый. Без shuffle — играет с `startIndex`, пропуская дизлайкнутые.
- **`toggleShuffle` во время воспроизведения.** Перемешивает оставшиеся треки
  (после текущего), проигранные не трогает.
- **`next` / `prev` при shuffle.** Убран `pickRandomNonDislikedIndex` — при
  перемешанной очереди случайность была двойной. Обход линейный; при достижении
  конца очередь перемешивается заново.
- **Дизлайки не сохранялись при перезагрузке.** `dislikes.restore()` не
  вызывался при старте приложения.
- **Кэш метаданных** — при обеих упавших внешних API (`iTunes` + `Deezer`)
  пустой результат больше не кэшируется на 24 часа.
- **Кэш настроек** — после `PUT /api/disk/text` на `.settings.json` кэш
  инвалидируется. Раньше изменения не применялись 5 минут.

### Removed

- Дубликат `UNKNOWN_ARTIST_PLACEHOLDER` из `useMetadataSearch.ts` и
  `MetadataApplier.ts`.

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
