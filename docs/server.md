# Сервер (Express)

## Структура модулей

```
server/src/
├── index.mjs              # Точка входа: middleware, маршруты, старт
├── modules.js             # mountModules() — сборка роутеров
├── core/                  # Ядро сервера
│   ├── session.js         # Express session middleware
│   ├── passport.js        # Стратегия Yandex OAuth (PKCE S256)
│   ├── routes.js          # OAuth маршруты
│   └── middleware/
├── metadata/              # Автопоиск метаданных
│   ├── routes.js          # GET /track-metadata
│   ├── similarity.js      # Jaro-Winkler + NFC normalize
│   └── parseTitle.js      # Парсинг "Artist - Title" из имени файла
├── plugins/
│   ├── yandex/            # Яндекс.Диск
│   ├── yandex-self/       # Логии (text files, upload)
│   ├── zvuk/              # СберЗвук (search, stream)
│   ├── podcasts/          # Прокси RSS
│   ├── radio/             # Radio Browser API
│   ├── feedback/          # Обратная связь
│   ├── telemetry/         # Аналитика (JSONL)
│   └── hls-proxy/         # Прокси HLS манифестов и сегментов
└── shared/
    ├── audio.js           # audioExtensions Set
    ├── yandexApi.js       # Обёртка над Yandex Disk API
    ├── aliases.js         # Variant search для артистов
    ├── errors.js          # YandexApiError
    └── logger.js
```

## Маршруты сервера

### Core (prefix: `/api`)

| Method | Path                    | Описание                       |
| ------ | ----------------------- | ------------------------------ |
| GET    | `/auth/yandex/start`    | OAuth redirect на Яндекс       |
| GET    | `/auth/yandex/callback` | OAuth callback (PKCE exchange) |
| GET    | `/auth/me`              | Проверка авторизации           |
| POST   | `/auth/logout`          | Logout                         |
| GET    | `/health`               | Health check                   |

### Metadata (prefix: `/api`)

| Method | Path                                        | Описание                           |
| ------ | ------------------------------------------- | ---------------------------------- |
| GET    | `/track-metadata?artist=&title=&threshold=` | Поиск метаданных (iTunes + Deezer) |

Кэширует результаты на 24 часа. Rate limit для Deezer: 500ms.

### Yandex Disk (prefix: `/api/disk`)

| Method | Path                    | Описание                  |
| ------ | ----------------------- | ------------------------- |
| GET    | `/disk/resources?path=` | Список ресурсов в папке   |
| GET    | `/disk/download?path=`  | Скачивание файла (stream) |
| GET    | `/disk/text?path=`      | Чтение текстового файла   |
| PUT    | `/disk/text?path=`      | Запись текстового файла   |

Все маршруты требуют авторизации (`requireSession`).

### Yandex Self / Логии (prefix: `/api/yandex-self`)

| Method | Path                      | Описание                       |
| ------ | ------------------------- | ------------------------------ |
| POST   | `/yandex-self/auth`       | Авторизация (context:password) |
| POST   | `/yandex-self/logout`     | Logout                         |
| GET    | `/yandex-self/auth/check` | Проверка сессии                |
| GET    | `/yandex-self/resources`  | Список ресурсов                |
| GET    | `/yandex-self/download`   | Скачивание                     |
| GET    | `/yandex-self/text`       | Чтение текстового файла        |
| PUT    | `/yandex-self/text`       | Запись текстового файла        |
| POST   | `/yandex-self/folder`     | Создание папки                 |
| DELETE | `/yandex-self/resource`   | Удаление ресурса               |
| POST   | `/yandex-self/move`       | Перемещение                    |
| PUT    | `/yandex-self/upload`     | Загрузка файла                 |

### Zvuk (prefix: `/api/zvuk`)

| Method | Path                            | Описание                         |
| ------ | ------------------------------- | -------------------------------- |
| GET    | `/zvuk/search?q=&types=`        | Поиск треков/альбомов/артистов   |
| GET    | `/zvuk/metadata?artist=&title=` | СтRICT поиск для автоподстановки |
| GET    | `/zvuk/stream?id=`              | Прокси стрима (get stream URL)   |

Заголовки: `x-zvuk-token` для аутентификации.

### Podcasts (prefix: `/api/podcasts`)

| Method | Path                   | Описание                                   |
| ------ | ---------------------- | ------------------------------------------ |
| GET    | `/podcasts/proxy?url=` | Прокси RSS-ленты (30MB limit, 15s timeout) |

### HLS Proxy (prefix: `/api`)

| Method | Path              | Описание                                                 |
| ------ | ----------------- | -------------------------------------------------------- |
| GET    | `/hls-proxy?url=` | Прокси HLS: переписывает манифест m3u8, стримит сегменты |

Переписывает относительные ссылки в m3u8 на `/api/hls-proxy?url=...`.

### Telemetry (prefix: `/api/telemetry`)

| Method | Path         | Описание            |
| ------ | ------------ | ------------------- |
| POST   | `/telemetry` | Приём JSONL-событий |

### Feedback (prefix: `/api/feedback`)

| Method | Path        | Описание                       |
| ------ | ----------- | ------------------------------ |
| POST   | `/feedback` | Обратная связь от пользователя |

## Middleware

1. `cors` — разрешённые origin из `FRONTEND_ORIGIN`
2. `express.json()` — парсинг JSON (лимит 1MB)
3. `sessionMiddleware` — session store
4. `passport.initialize()` + `passport.session()` — сессии с OAuth
5. `metadataRouter` — маршруты метаданных
6. `yandexRoutes` — маршруты Яндекс.Диска
7. `feedbackRoutes` — обратная связь
8. `yaSelfRoutes` — Логии
9. `podcastsRoutes` — подкасты
10. `hlsProxyRoutes` — HLS прокси
11. `zvukRoutes` — СберЗвук
12. `telemetryRoutes` — телеметрия
13. Error handler — глобальная обработка ошибок

## Авторизация

Yandex OAuth 2.0 с PKCE (S256):

1. `/auth/yandex/start` → redirect на Яндекс с code_challenge
2. `/auth/yandex/callback` → обмен code на access_token + refresh_token
3. Passport хранит токены в сессии (`req.user.accessToken`)
4. Фронтенд получает `req.user` через cookie `connect.sid`
