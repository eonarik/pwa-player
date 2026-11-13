## done

- [x] Storybook + UI-слои: рабочий Storybook 10 (40+ историй), переезд на atoms/molecules/organisms с линтер-границами, темизация через Global Toolbar и сетка тем в песочницах, `docs/storybook.md`. Пункт «флоу для разных сценариев» закрыт этой работой: справочником вариантов отображения служат stories, а не статичные флоу-схемы
- [x] Переработка `yandex-self` в Логии: плагин переименован, движок LOGII-оценок вынесен в shared, треки получают ID формата `lgcyid://`; интерфейс обновлён относительно макета
- [x] Confluence-подобная документация.
- [x] Alphabet scroll: клик по букве скроллит к секции (фикс gridRef в ArtistsView).

## todo

### bugs

- [ ] Ошибка в консоли: "[Unhandled Rejection] TypeError: Cannot set properties of undefined (setting 'height')" в LogiiView
- [ ] При полном пересканировании (force scan) - папки не помечаются статусами.
      upd: текущая архитектура работает как и должна, претензия к визуальному оформлению при перескане. неясно какие из папок в данным момент пересканируются и каков прогресс перескана.

- [ ] connect для local добавляет только одну папку за раз, повторное подключение недоступно
Симптом: нажал «Подключить» → выбрал папку → карточка перешла в «Подключено», кнопка «Подключить» исчезла. Вторую и третью папку добавить из UI нельзя.
Ожидаемо: либо пикер с multiple: true (выбор нескольких папок за один раз), либо возможность добавлять папки повторно, пока плагин «подключён».
Код: src/plugins/local/index.ts → connect (pickDirectory() + addHandle() один раз); src/views/home/PluginCard.vue → ветка !isDisconnected рендерит только «Открыть»/«Отключить».
Примечание: FileSystemService.addHandle умеет хранить массив handles, но pickDirectory возвращает один handle, и UI не даёт вызвать его снова.

- [ ] openPlugin для local ведёт в первую корневую папку, а не в список выбранных
Симптом: выбрано 3 папки, local.load строит 3 корня (parentId === null), но после «Открыть» пользователь всегда попадает в первую. До второй и третьей навигации нет.
Ожидаемо: root — список всех выбранных папок; из него можно войти в любую.
Код: src/composables/usePluginActions.ts → doOpenPlugin → findRoot() (Array.find → первая с parentId === null) → router.push на её urlPath. Плюс src/components/library/FolderBreadcrumbs.vue: на корне показывает «Источники» → home, соседние корни не показывает.

- [ ] urlPath: '' у первого local-корня — потенциальная коллизия
Симптом: первый корень получает urlPath: '' (ветка newFolderMap[''] = handleRootId в local.load), остальные — handle.name. FolderRoute ищет папку по pluginId + urlPath, и '' может совпасть с корнем другого плагина или с «пустым» маршрутом.
Ожидаемо: у каждого корня уникальный непустой urlPath (например, handle.name для всех, включая первый), либо явное правило разрешения коллизий.
Код: src/plugins/local/index.ts → load, ветка if (handles[0] && handle.name === handles[0].name).

- [ ] hasLocalFiles не различает «одна папка» и «N папок»
Симптом: checkLocalFiles в usePluginsList возвращает true при первой же непустой папке. При 3 выбранных папках, из которых 2 пустые, статус будет «есть локальные файлы», хотя реально непустая одна.
Ожидаемо: либо счётчик папок/треков в статусе, либо явное «есть локальные файлы» без привязки к количеству (если так задумано — зафиксировать как ожидаемое).
Код: src/composables/usePluginsList.ts → checkLocalFiles (for await ... return true).
Приоритет: низкий, скорее «уточнить поведение», чем баг.

- [ ] stores.md устарел относительно кода (порядок инициализации)
Симптом: в docs/stores.md порядок «плеер → плагины → cleanupOrphanTracks». В коде (useAppBootstrap) плагины грузятся до player.restore, а metadataService.flush() и sortService.load() в списке вообще нет. Подрядчик, опираясь на доку, воспроизведёт неверный порядок.
Ожидаемо: stores.md синхронизирован с useAppBootstrap (две фазы: fast/background).
Код: docs/stores.md vs src/composables/useAppBootstrap.ts.

- [ ] FolderRoute тихо редиректит на home, если папки нет, а библиотека не пуста
Симптом: пользователь открыл закладку/ссылку на папку, которой уже нет (переименована на Диске, удалена, скан не прошёл) — его молча выкидывает на home, без объяснения.
Ожидаемо: тост «Папка не найдена» или экран «Папка недоступна» с кнопкой «На главную».
Код: src/views/FolderRoute.vue → watch([currentFolder, pluginId]) → router.replace({ name: 'home' }).
Приоритет: низкий-средний (UX, не ломает данные).

- [ ] refreshFromCloud/refreshFromCloudShallow при isDisconnected вызывают connect без onReload
Симптом: папка открыта у отключённого плагина (например, yandexDisk после истечения сессии). Пользователь жмёт «Обновить с облака» — срабатывает plugin.connect(context), но usePluginsList.loadPlugins() не перезапускается, sessionStatuses/isDisconnected в HomeView и в карточке остаются старыми. Плюс connect может кинуть redirect/cancelled — они не перехвачены (в отличие от usePluginActions.connectPlugin, где эти два случая глотаются), и упадут в общий catch → «Не удалось обновить с облака» + needsAttention = true, хотя на самом деле был OAuth-редирект.
Ожидаемо: после connect — onReload (или локальное обновление статуса); redirect/cancelled не приводят к needsAttention.
Код: src/composables/useFolderSync.ts → refreshFromCloud/refreshFromCloudShallow, блок if (plugin.isDisconnected?.()).
Приоритет: средний (OAuth-редирект выглядит как ошибка синка).

- [ ] refreshFromDevice вызывает syncService.syncAll() по всем плагинам, а не по текущему
Симптом: пользователь в папке yandexDisk жмёт «Обновить с устройства», а syncAll() сканирует все canDownload плагины (включая podcasts, yandex-self). Долго, прогресс не привязан к текущей папке, issueCount смешивает расхождения всех плагинов.
Ожидаемо: либо syncService.scanPlugin(currentPluginId) (точечно), либо явно «Обновить все источники» в тексте кнопки.
Код: src/composables/useFolderSync.ts → refreshFromDevice → syncService.syncAll().
Приоритет: средний (UX + лишняя нагрузка). Требует подтверждения: возможно, syncAll задуман как «всё», и тогда это не баг, а название кнопки вводит в заблуждение.

- [ ] isPluginScanning — polling каждые 500ms без остановки по isScanning === false
Симптом: setInterval(..., 500) создаётся на watch(pluginId) и живёт, пока не сменится плагин или не размонтируется компонент. Даже когда isScanning уже false, интервал продолжает дёргать activePlugin.isScanning?.(). На плагинах, где isScanning дорогой, это лишняя нагрузка; на local/zvuk (без isScanning) — пустой вызов каждые 500ms.
Ожидаемо: останавливать интервал, когда isScanning === false (и перезапускать по событию/scanState), либо увеличить интервал.
Код: src/composables/useFolderSync.ts → третий watch(pluginId), pluginScanTimer.
Приоритет: низкий.

- [ ] FolderHeader при currentFolder === null всё равно рендерит FolderActionsMenu
Симптом: FolderActionsMenu :folder="currentFolder" — если null, меню рендерится с null-папкой. Что оно делает в этом состоянии — не видно из этого файла, но FolderHeader не оборачивает его в v-if="currentFolder".
Ожидаемо: либо v-if, либо FolderActionsMenu сам корректно обрабатывает null (тогда зафиксировать).
Код: src/views/folder/FolderHeader.vue → <FolderActionsMenu :folder="currentFolder" ... /> без v-if.
Приоритет: низкий, требует подтверждения по FolderActionsMenu.vue.

- [ ] BUG-013. shouldSkipAuto всегда передаёт isDownloading: false
Симптом: трек, который сейчас скачивается (kind: 'downloading' по типу Playability), не считается «пропускаемым», но и не играет — playAt попробует resolveTrackSource, упадёт, и только тогда skipToNextOnError. Лишняя попытка + возможный тост.
Ожидаемо: isDownloading брать из DownloadOrchestrator (там есть getTransferState), и либо скипать, либо играть после завершения.
Код: src/stores/player/actions/helpers.ts → shouldSkipAuto, литерал isDownloading: false.
Приоритет: низкий-средний.

- [ ] BUG-014. playback.play() содержит мёртвую ветку currentTrack === null && queue.length > 0

Симптом: return без действия. Обёртка playWrapper в index.ts перехватывает этот случай (playAt(0)), так что до playback.play() он не доходит. Но если кто-то вызовет playback.play() напрямую — плеер «залипнет» без звука и без тоста.
Ожидаемо: убрать ветку из playback.play() (она там не нужна) или заменить на playAt(0).
Код: src/stores/player/actions/playback.ts → play().
Приоритет: низкий (защита от будущих рефакторингов).

- [ ] BUG-015. handleAuthError при AuthError в playAt делает return и не пробует следующий источник

Симптом: у трека два cloud-источника (например, yandexDisk с истёкшей сессией и zvuk streaming). playAt берёт первый по priority, ловит AuthError, показывает тост «Сессия истекла… Подключить?» и выходит из цикла — второй источник даже не пробуется. Пользователь жмёт «Подключить», чинит первый, но если он не хочет — трек не играет, хотя второй источник живой.
Ожидаемо: при AuthError — либо continue к следующему источнику, либо после handleAuthError не выходить, а попробовать остальные. Сейчас return стоит до lastError = ..., то есть AuthError не доходит до финального «все источники недоступны».
Код: src/stores/player/actions/navigation.ts → playAt, блок if (err instanceof AuthError) { handleAuthError(err, track); return; }.
Приоритет: средний-высокий (это как раз «сломали флоу»: трек с несколькими источниками не переключается).

- [ ] BUG-016. applyRestoredPlayback при ошибке resolveTrackSource молча выходит

Симптом: после F5 сохранённый трек не восстанавливается (сессия истекла, файл удалён, handle недоступен) — плеер остаётся с восстановленной очередью, но без загруженного аудио. Пользователь видит очередь и currentTrack, жмёт play — playback.play() видит sources.length > 0 (они есть!), зовёт audioService.play() без load, получает ошибку в консоль.
Ожидаемо: либо skipToNextOnError при неудаче resolveTrackSource, либо currentTrack = null / isPlaying = false и тост.
Код: src/stores/player/playerRestore.ts → applyRestoredPlayback, catch { return; }.
Приоритет: средний-высокий (тихий сбой восстановления).

- [ ] BUG-017. applyRestoredPlayback берёт sortedSources[0], но не обновляет currentTrack/queue при неудаче

Симптом: связан с BUG-016. Даже если resolveTrackSource упал, queue[currentIndex] и currentTrack остаются указывать на трек с нерабочим первым источником. При следующем playAt цикл попробует источники заново — но пользователь уже нажал play и получил тишину.
Ожидаемо: при неудаче — либо skipToNextOnError, либо пометить трек и показать «источник недоступен».
Код: src/stores/player/playerRestore.ts → applyRestoredPlayback.
Приоритет: средний (связан с BUG-016, можно объединить).

- [ ] BUG-018. next()/prev() при shuffle и repeatMode === 'all' могут зациклиться на одном треке

Симптом: findPlayableIndex с shouldSkipAuto вернёт -1, если все треки в очереди — дизлайкнутые/недоступные. Тогда next() идёт в ветку shuffle → reshuffled = shuffle(rest) (без текущего) → если все остальные тоже skip → firstPlayable === -1 → isPlaying=false, pause. Это ок. Но при repeatMode === 'all' и queue.length === 1 (один трек, дизлайкнут) — findPlayableIndex(queue, 0, +1) вернёт -1 (сам трек skip), wrapIndex === -1, падаем в pause. Формально ок, но hasNext в сторе при repeatMode === 'all' возвращает true — кнопка «next» активна, а по факту ничего не делает.
Ожидаемо: либо hasNext/hasPrev учитывают shouldSkipAuto, либо next() при -1 показывает тост «Нет доступных треков».
Код: src/stores/player/index.ts → hasNext/hasPrev; src/stores/player/actions/navigation.ts → next/prev.
Приоритет: низкий-средний (UX: активная кнопка без эффекта).

- [ ] BUG-019. handleAuthError берёт track.sources[0] без сортировки по priority

Симптом: const pluginId = track.sources[0] ? pluginIdFromSource(track.sources[0].pluginId) : '' — берёт первый в массиве, а не приоритетный. В playAt источники отсортированы по priority, и AuthError прилетел именно от приоритетного. Если массив sources не отсортирован (а он не гарантированно отсортирован — Track.sources хранится как есть), handleAuthError может предложить подключить не тот плагин.
Ожидаемо: [...track.sources].sort((a,b)=>a.priority-b.priority)[0].
Код: src/stores/player/actions/errors.ts → handleAuthError.
Приоритет: средний (неверный плагин в тосте «Подключить»).

- [ ] BUG-020. setQueue при shuffle ставит currentIndex = 0, но originalQueue уже содержит tracks в исходном порядке — при выключении shuffle currentIndex пересчитывается по current.id, это ок. Но watch([queue, currentIndex, ...]) в сторе дебаунсит сохранение — при быстром setQueue + playAt возможна запись промежуточного состояния
Симптом: теоретический. watch на queue/currentIndex вызывает scheduleSaveState, а playAt меняет currentIndex и queue в разных тиках. Дебаунс сглаживает, но при закрытии вкладки между ними — сохранён currentIndex без соответствующего queue.
Ожидаемо: либо сохранять атомарно (currentIndex+queue в одном watch с flush: 'post'), либо в buildState сверять currentIndex < queue.length.
Код: src/stores/player/index.ts → watch([queue, currentIndex, ...]).
Приоритет: низкий (дебаунс почти всегда спасает; BUG-016/017 ближе к реальности).

- [ ] BUG-022. TrackList не передаёт queueIndex в TrackActions
Симптом: в FolderView у трека в списке нет «Убрать из очереди» (потому что queueIndex не передан). Это, вероятно, ожидаемо (убирать из очереди логично в QueueView), но тогда TrackActions.queueIndex — мёртвый проп для этого контекста.
Ожидаемо: зафиксировать как «ожидаемое поведение» (в FolderView нет удаления из очереди) или добавить queueIndex из player.queue.
Код: src/components/library/TrackList.vue → <TrackActions :track="..." /> без queueIndex.
Приоритет: уточнить, не баг.

- [ ] BUG-023. TrackList scrollMargin считается один раз и не пересчитывается при изменении layout (например, открытие FullPlayer)

Симптом: updateMeasurements вызывается на onMounted, resize, watch(length), scrollToCurrent. Если FolderFilters/FolderHeader меняют высоту (например, MetadataMenu раскрылся, или появился FileLocationFilter), scrollMargin устаревает, и виртуализатор рисует элементы со смещением.
Ожидаемо: ResizeObserver на контейнер/скролл-родитель, а не только window.resize.
Код: src/components/library/TrackList.vue → updateMeasurements.
Приоритет: низкий-средний (визуальный баг при динамическом layout).

- [ ] BUG-024. bindAudioEvents.on('error') вызывает skipToNextOnError() без проверки getIsRestoring()
Симптом: при восстановлении после F5, если audioService.load/play кинул нативное error (например, autoplay-блок в Safari даёт NotAllowedError не через play() reject, а через error-событие — редко, но бывает), skipToNextOnError переключит трек, хотя пользователь ещё не взаимодействовал. Плюс trackStartedAt останется от предыдущего трека.
Ожидаемо: в error при getIsRestoring() — не скипать, а isPlaying=false и выйти.
Код: src/stores/player/events.ts → audioService.on('error', ...).
Приоритет: низкий-средний.

### normal priority

#### Логии

- [ ] Добавить рядом с загрузкой трека в логиях кнопку поиска в стриминговых провайдерах (предоставляется другими плагинами)
- [ ] Кнопки редактирования\удаления у авторов и топов в Логиях сделать выпрыгивающими справа при ховере, поочередно, как мячики
- [ ] Нормализовать кнопки редактирования\удаления комментария (w-8,h-8, IconButton)
- [ ] Инпут ввода никнейма переместиить ниже списка комментариев, сразу над вводом комментария
- [ ] В логиях никак не помечаются открытая в данный момент папка автора. Есть метка - папка, в которой играет рек (помечено фоном). Нужно различать эти два состояния как для авторов, так и для топов. Папка, в которой играет трек и папка, открытая в данный момент.
- [ ] Адаптация Логий под мобильные

#### other

- [ ] Добавить глобальный обработчик для всех глобальных фоновых процессов (в котором можно будет приостанавливать, возобновлять и отменять такие процессы)
- [ ] Storybook для виджетов плагинов (BandPlayerWidget, YandexLoginGate) — нужны моки `audioService`/сторов

### low priority

- [ ] Ссылки для шаринга (deep links на трек). (ресерч показал, что лучший вариант - дать возможность сохранять снимок плейлиста на сервер)
- [ ] Импорт плейлистов с других сервисов (в виде снимков)
- [ ] Продвинутая работа с файлами и Экосистема (что имелось ввиду уже не помню. возможно, skip)
- [ ] Распознавание песни в браузере: генерация аудио-отпечатка через WASM (vibra) + отправка на бесплатный API для поиска трека. Распознавание трека в Радио, добавление его в плейлист
