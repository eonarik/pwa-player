## done

- [x] [CUEI-0005] Логии: поиск в стриминговых провайдерах (контракт searchTracks/fetchAudioBlob, модалка, загрузка blob → Диск)
- [x] [CUEI-0011] Логии: совместить текст и комментарии в одном виде (не перетыкивать «трек»/«чат»).
      Фидбек реального пользователя: «Текст из текстовика разделён, от автора часть лежит в описании мелодии, а комменты лежат отдельно.
      Мне просто комфортно писать в текстовике, видеть весь текст, что там есть, а не перетыкивать кнопки "трек" - "чат", чтобы иметь возможность почитать и там и там».
- [x] [CUEI-0012] Логии: панель уведомлений об изменениях («был изменен такой-то файл, добавлен такой-то трек»).
      Фидбек реального пользователя: «а еще хочется панель уведомлений для логий: типа был изменен такой-то файл, добавлен такой-то трек».
- [x] [CUEI-0006] Кнопки редактирования\удаления у авторов и топов в Логиях сделать выпрыгивающими справа при ховере, поочередно, как мячики (Teleport в body)
- [x] [CUEI-0007] Нормализовать кнопки редактирования\удаления комментария (w-8,h-8, IconButton)
- [x] [CUEI-0008] Инпут ввода никнейма переместить ниже списка комментариев, сразу над вводом комментария
- [x] [CUEI-0009] В логиях никак не помечаются открытая в данный момент папка автора. Есть метка - папка, в которой играет трек (помечено фоном). Нужно различать эти два состояния как для авторов, так и для топов. Папка, в которой играет трек и папка, открытая в данный момент.
- [x] [CUEI-0022] Колокольчик: подавление штатных удалений/переименований при форс-скане (уведомления не должны включать штатное удаление папок и файлов при форс-скан)
- [x] [CUEI-0023] Race-условие при быстром переключении папок (базовый race закрыт; остаточный race при переключении папок топа — см. CUEI-0025)
- [x] [CUEI-0024] Режим редактирования (переключатель) - доступность create, update, delete операций
- [x] [CUEI-0010] Адаптация Логий под мобильные (карусель-пейджер: авторы → папки → контент, свайп, точки-индикатор, inline CRUD)
- [x] [CUEI-0025] Если переключить на другую папку топа, ее содержимое начнет подгружаться. если в это время резко переключиться обратно - можно пронаблюдать как корректный контент заменяется загруженным из предыдущей папки.
      upd: id исправлен с CUEI-0023 (был дубликат с done-пунктом).

## todo

### bugs

- [ ] [CUEI-0002] urlPath: '' у первого local-корня — потенциальная коллизия
      Симптом: первый корень получает urlPath: '' (ветка newFolderMap[''] = handleRootId в local.load), остальные — handle.name. FolderRoute ищет папку по pluginId + urlPath, и '' может совпасть с корнем другого плагина или с «пустым» маршрутом.
      Уточнение при проверке кода: сравнение в ветке идёт по ИМЕНИ (handle.name === handles[0].name), а не по позиции. Две одноимённые папки перезаписывают запись folderMap друг друга (в описании настроек это признано: «Папки с одинаковыми именами перезапишут друг друга»).
      Ожидаемо: у каждого корня уникальный непустой urlPath (например, handle.name для всех, включая первый), либо явное правило разрешения коллизий.
      Код: src/plugins/local/index.ts → load, ветка if (handles[0] && handle.name === handles[0].name).

- [ ] [CUEI-0004] FolderRoute тихо редиректит на home, если папки нет, а библиотека не пуста
      Симптом: пользователь открыл закладку/ссылку на папку, которой уже нет (переименована на Диске, удалена, скан не прошёл) — его молча выкидывает на home, без объяснения.
      Ожидаемо: тост «Папка не найдена» или экран «Папка недоступна» с кнопкой «На главную».
      Код: src/views/FolderRoute.vue → watch([currentFolder, pluginId]) → router.replace({ name: 'home' }).
      Приоритет: низкий-средний (UX, не ломает данные).

### normal priority

#### Логии

#### other

- [ ] [CUEI-0013] Добавить глобальный обработчик для всех глобальных фоновых процессов (в котором можно будет приостанавливать, возобновлять и отменять такие процессы)
- [ ] [CUEI-0014] Storybook для виджетов плагинов (BandPlayerWidget, YandexLoginGate) — нужны моки `audioService`/сторов
- [ ] [CUEI-0019] Перенести апи радио на прокси (есть проблема блокирования в некоторых провайдерах интернета)
- [ ] [CUEI-0020] Добавить скелетоны на loading во все возможные списки компонентов. Создать сторис для разного вида скелетонов
- [ ] [CUEI-0021] Если в источниках есть path, то при опции "Показать источник" выводить последние три секции, остальное скрыть за ...
      например: .../Folder1/Folder2/Folder3
- [ ] [CUEI-0001] Прогресс и статус пересканирования локальных папок (UX)
      Изначально был в bugs как «папки не помечаются статусами при force scan». При проверке кода: архитектура работает корректно, rescanFolder (src/plugins/local/settings.ts) делает полный rebuildAndSave() без прогресса. Претензия только к визуальному оформлению: неясно, какая папка пересканируется и каков прогресс.

### low priority

- [ ] [CUEI-0015] Ссылки для шаринга (deep links на трек). (ресерч показал, что лучший вариант - дать возможность сохранять снимок плейлиста на сервер)
      разделение на приватные плейлисты - и плейлисты общего доступа (хранятся в разных папках)
      общедоступные - каждый может их открыть, приватные доступны только по ссылке, либо специальному коду
- [ ] [CUEI-0016] Импорт плейлистов с других сервисов (в виде снимков)
- [ ] [CUEI-0017] Продвинутая работа с файлами и Экосистема (что имелось ввиду уже не помню. возможно, skip)
- [ ] [CUEI-0018] Распознавание песни в браузере: генерация аудио-отпечатка через WASM (vibra) + отправка на бесплатный API для поиска трека. Распознавание трека в Радио, добавление его в плейлист

### tech debt (docs)

Найдено при ревизии документации (`docs/services.md`, `docs/stores.md`, `docs/architecture.md`, `docs/conventions.md`). Не баги данных, но стоит закрыть.

- [ ] [CUEI-0026] `metadataPersistenceService.load()` не вызывается при старте: кэш автопоиска не подгружается, not-found TTL не работает между сессиями.
      Код: `src/services/persistence/MetadataPersistenceService.ts` (load), `src/main.ts` / `src/composables/useAppBootstrap.ts` (нет вызова).
      Объединено с CUEI-0027: в fast phase bootstrap стоит `await metadataService.flush()` (`useAppBootstrap.ts`) — вероятно, должно быть `load()` (flush перед restore бессмыслен). Чинить вместе, одна правка в одном файле.
      Docs: `docs/services.md` (Metadata), `docs/stores.md` (порядок инициализации), `docs/architecture.md` (Bootstrap).
- [ ] [CUEI-0029] `PersistenceService.toPersisted(track)` — identity-функция, вызовов нет (grep по src), мёртвый код. Удалить при ближайшем касании `PersistenceService`.
      Код: `src/services/persistence/PersistenceService.ts` → `toPersisted`.
      Docs: `docs/services.md` (Persistence).
- [ ] [CUEI-0030] `AudioService.unload()` vs `releaseCurrent()` — почти идентичны (разница: `unload` делает `hls.destroy()` + `hls.reset()`, `releaseCurrent` — нет; разные telemetry-события). Оба метода живы: `unload` — `src/stores/player/actions/playback.ts`, `releaseCurrent` — `src/composables/usePluginActions.ts`. Ветка «удалить» неактуальна. Остаётся: объединить или задокументировать семантику. Вероятный исход — задокументировать: `unload` рвёт HLS-поток (`hls.destroy`/`reset`), для radio/HLS это осмысленная разница; `releaseCurrent` оставляет HLS-контроллер живым.
      Код: `src/services/audio/AudioService/AudioService.ts`.
      Docs: `docs/services.md` (Audio).
- [ ] [CUEI-0031] `isStrictSameTrack` дублируется в `history.ts` и `dislikes.ts`. Вынести в общий модуль (например, `src/services/library/mergeHelpers.ts`).
      Код: `src/stores/history.ts`, `src/stores/dislikes.ts`.
      Docs: `docs/stores.md` (useHistoryStore, useDislikesStore).
- [ ] [CUEI-0032] Три persistence-сервиса (`PlaylistPersistenceService`, `HistoryPersistenceService`, `DislikesPersistenceService`) — копипаста (дебаунс 500ms, `save`/`saveNow`/`flush`/`load`/`clear`). Кандидат на обобщение через `createDebouncedPersistence<T>`.
      Код: `src/services/persistence/`.
      Docs: `docs/services.md` (Persistence).
- [ ] [CUEI-0034] Нормализация `pluginId` и `sources` при restore. Инвариант `pluginId === pluginIdFromSource(sources[0].pluginId)` и сортировка `sources` по `priority` обеспечиваются writer'ом (`normalizeSources` в `src/stores/library/writer/tracks.ts`) — но только на путях записи `addTracks`/`updateTrackSources`. `restoreTrack` (`src/services/persistence/restore.ts`) подсовывает persisted-sources **мимо** writer'а: если в persisted `sources` не отсортированы (старая версия) или `pluginId` рассинхронизирован (например, после `removeDownloaded` в предыдущей сессии), инвариант нарушится. Решение: прогонять persisted через существующую `normalizeSources` при restore (функция приватная — экспортировать либо вынести в общий модуль; пересекается с CUEI-0031 по месту жительства helper'ов).
      Код: `src/services/persistence/restore.ts`, `src/stores/library/writer/tracks.ts`.
      Docs: `docs/data-model.md` (инварианты Track), `docs/services.md` (Persistence).

### moved (не not-a-bug, для traceability)

- [CUEI-0001] Перенесён в `normal priority → other` как UX (прогресс пересканирования локальных папок). Не закрыт, не «не баг» — просто изменён приоритет/категория. При следующей ревизии не удалять как «уже закрытый».

### closed as not-a-bug (проверено по коду)

- [CUEI-0003] hasLocalFiles не различает «одна папка» и «N папок» — не баг. `hasLocalFiles` отражает «папка download-плагина не пуста» (первая непустая запись), что соответствует семантике статуса «есть/нет». Цикл `checkLocalFiles` в `usePluginsList.ts` вызывается только для `meta.plugin.canDownload`-плагинов; для local-плагина (`canDownload: false`) `hasLocalFiles` не вычисляется, его локальные папки отображаются отдельно через `manifest.hasCustomData`/`customDataMap`. Количество папок/треков в статусе не требуется — статус бинарный.
- [CUEI-0027] `metadataService.flush()` в fast phase bootstrap — объединён с `CUEI-0026` (одна правка в одном файле `useAppBootstrap.ts`).
- [CUEI-0028] `invokeApplyCandidate` с built-in провайдером — путь недостижим. У built-in кандидатов (`resolve.ts`) `extMetadata` не заполняется, а `invokeApplyCandidate` вызывается только при наличии `extMetadata` (`apply/candidate.ts`). Падений `loadPlugin('itunes')` в рантайме нет; ошибка и так перехватывается через `logger.error`. При добавлении `extMetadata` built-in в будущем — пересмотреть.
- [CUEI-0033] Кросс-стор через прямые импорты (`writer/index.ts` → `useUiSettingsStore`; `metadata/apply/merge.ts` → `usePlaylistsStore`/`useHistoryStore`/`useDislikesStore`; `player/actions/helpers.ts` → `useDislikesStore`) — сознательное задокументированное исключение (`docs/conventions.md`). Не работа, а принятое решение; при пересмотре выносить в архитектурное обсуждение.
