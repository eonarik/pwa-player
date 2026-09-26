# CUEI Media Player

Офлайн PWA-плеер для музыкальной библиотеки. Работает напрямую с локальной файловой системой через File System Access API, а также с Яндекс.Диском через собственный прокси. Без загрузки файлов на сторонние серверы, без аккаунтов, без интернета для локальной библиотеки.

## Возможности

**Локальная библиотека:**

- Прямой доступ к папкам через системный диалог, рекурсивное сканирование подпапок.
- Чтение ID3-тегов и обложек из тегов или файлов `folder.jpg` / `cover.jpg`.
- Навигация по папкам с хлебными крошками.
- Персистентность: библиотека, очередь и позиция воспроизведения сохраняются в IndexedDB.

**Яндекс.Диск:**

- Подключение к папке на Диске через локальный прокси.
- Рекурсивное сканирование с распараллеливанием (5 запросов одновременно).
- Кэширование в IndexedDB с TTL 24 часа — повторное подключение мгновенно.
- Автоподключение при старте, если последний источник был Диск.
- Точечное обновление текущей папки без полного пересканирования.

**Плеер:**

- Очередь, shuffle, repeat (off / all / one), громкость, seek.
- Media Session API — управление с локскрина и наушников.
- Горячие клавиши: Space, стрелки, N/P, M.
- Виртуализация списка через `requestAnimationFrame` и `ResizeObserver` с автоизмерением высоты.

**PWA:**

- Манифест, Service Worker, офлайн-кэш.
- Safe-area для iPhone, отключены overscroll и двойной тап-зум.
- Адаптивная вёрстка: компактный плеер на мобильных, полный — на десктопе.

## Требования

### Десктоп

**Браузер:** Chrome 86+, Edge 86+, Opera 72+.

**Не поддерживается:**

- Firefox — нет File System Access API.
- Safari — нет File System Access API.

### Мобильные

**Локальная библиотека не работает** — File System Access API недоступен ни на iOS, ни на Android.

**Яндекс.Диск работает** через прокси. Но есть нюансы:

- На iOS аудио в PWA (добавленной на домашний экран) может не играть из-за бага WebKit. Используйте обычный Safari или Chrome.
- Прокси должен быть доступен по сети — не `localhost`, а IP вашей машины.

## Установка и запуск

```bash
# Клонировать репозиторий
git clone <url>
cd cuei-player

# Установить зависимости
yarn install
# или
npm install

# Настроить прокси (опционально, только для Яндекс.Диска)
cd server
yarn install
cp .env.example .env

# Запустить dev-сервер
yarn dev

# Собрать production-сборку
yarn build

# Прогнать тесты
yarn test:unit --run

# Линтер
yarn lint
```

`server/.env`

```md
# OAuth-токен Яндекс.Диска.

# Как получить — см. раздел «OAuth-токен Яндекс.Диска» ниже.

YANDEX_TOKEN=

# Путь к папке с музыкой на Яндекс.Диске.

# Например: /Музыка или /лежни

YANDEX_MUSIC_PATH=/Music

# Секретный ключ для подписи JWT-токенов авторизации.

# Сгенерируй: openssl rand -hex 32

# ВАЖНО: на Vercel задать тоже, иначе сессии будут сбрасываться при каждом холодном старте.

AUTH_SECRET=

# Порт прокси (для локальной разработки)

PORT=3000

# Origin фронтенда для CORS

FRONTEND_ORIGIN=http://localhost:5173
```

### Как получить OAuth-токен:

- Создай приложение на https://oauth.yandex.ru/ типа «Для доступа к API или отладки».
- Добавь разрешения cloud_api:disk.read и cloud_api:disk.info.
- Открой https://oauth.yandex.ru/authorize?response_type=token&client_id=<ClientID>.
- Скопируй токен из адресной строки и вставь в .env.

## Поиск обложек

Фронт умеет искать обложки для треков, у которых их нет в тегах или folder.jpg. Работает через прокси, который обращается к iTunes Search API и Deezer API.

#### Приоритет источников

- iTunes Search API — первым.
- Deezer API — fallback.

## Ключевые архитектурные решения

**Нормализованная библиотека.** Папки и треки хранятся плоскими `Record<string, Folder>` и `Record<string, LibraryTrack>`, а не деревом. Связи — через parentId и childFolderIds / trackIds. Это удобнее для виртуализации и сериализации.

**Разделение стора плеера и библиотеки.** player ничего не знает про библиотеку — он работает с очередью `Track[]`. Библиотека живёт отдельно и наполняет очередь через setQueue. Это позволяет позже добавить другие источники (плейлисты, Яндекс.Диск).

**Плейлисты хранят снимки, а не ссылки.** PlaylistTrackSnapshot содержит trackId, title, artist, remotePath. Это устойчиво к смене источника: даже если трек недоступен, плейлист помнит, что там было.

**URL как источник правды для навигации.** Текущая папка определяется URL (`/folder/путь/к/папке`). Стор `library.currentFolderId`— зеркало URL. Это даёт работающие `back/forward`, закладки и восстановление после перезапуска.

**Виртуализация без фиксированной высоты.** Высота элемента измеряется через ResizeObserver на скрытом эталоне. Меняешь дизайн `TrackListItem` — виртуализация подстраивается сама.

**Прокси для Яндекс.Диска.** CORS-политика Яндекса не даёт браузеру ходить к cloud-api.yandex.net напрямую. Тонкий Node-прокси добавляет OAuth-токен и CORS-заголовки. Токен хранится только на сервере.

**Кэш Диска с TTL.** Библиотека Диска хранится в IndexedDB под отдельным ключом, с TTL 24 часа. При повторном подключении — мгновенная загрузка из кэша. При старте — автоподключение, если последний источник был Диск.

**Кэш обложек по trackId, а не по artist|album.** URL обложек хранятся как строки (не blob), что не раздувает IDB. Deezer-обложка навсегда, null — с TTL 7 дней

## Деплой

### Vercel

Проект задеплоен на Vercel с использованием Services (фронт + бэкенд в одном проекте). Конфигурация в vercel.json:

```json
{
  "services": {
    "frontend": { "root": "." },
    "backend": {
      "root": "server/",
      "entrypoint": "src/index.mjs",
      "framework": "express"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ]
}
```

Важно:

- Entrypoint — .mjs, а не .ts. Vercel Services не умеет запускать TypeScript-entrypoint Express-сервера. .mjs работает.
- Переменные окружения в Vercel Dashboard → Settings → Environment Variables:

  - YANDEX_TOKEN (Secret, Production/Preview/Development).
  - YANDEX_MUSIC_PATH (Config).
  - AUTH_SECRET (Secret).
  - VITE_DISK_PROXY_URL не задавать на Vercel. Фронт использует относительные пути /api/..., Vercel Services роутит их на бэкенд.

- Локально в .env.local: VITE_DISK_PROXY_URL=http://localhost:3000.

## Тесты

```bash
yarn test:unit --run         # однократный прогон
yarn test:unit               # watch-режим
yarn test:unit --ui          # UI-режим Vitest (если установлен @vitest/ui)
```

## Технологии

#### Фронтенд

- Vue 3 + Composition API
- Vite — сборка
- TypeScript
- Pinia — состояние
- Vue Router
- Tailwind CSS v4
- music-metadata-browser — парсинг тегов
- idb-keyval — IndexedDB
- Vitest + @vue/test-utils — тесты
- vite-plugin-pwa — PWA

#### Прокси

- Node.js 18+
- Express
- TypeScript
- tsx (dev-раннер)
- dotenv

#### API

- File System Access API
- Media Session API
- Yandex Disk REST API
- iTunes Search API
- Deezer API

## Roadmap

[x] Навигация по папкам с breadcrumbs
[x] Персистентность библиотеки и плеера
[x] PWA (манифест, Service Worker)
[x] Мобильная адаптация (safe-area, overscroll, touch-action)
[x] Прокси для обхода CORS
[x] Кэш с TTL 24 часа и автоподключение
[x] Точечное обновление папки
[x] Авторизация (.settings.json, JWT, публичные папки)
[x] Поиск обложек (iTunes + Deezer, кэш, сброс)
[x] Пользовательские плейлисты
[x] Избранное (системный плейлист)
[x] История воспроизведения
[] Переработка дизайна (в работе у дизайнера)
[] Скачивание плейлистов на локаль (рекурсивно, с прогрессом и отменой)
[] Скачивание из истории
[] Удаление из локали
[] Поиск по библиотеке
[] Панель очереди
[] Отделение Яндекс.Диска в опциональный плагин
[] Редактирование текстовых файлов (отложено)
[] Capacitor для iOS (если понадобится)
[...] Тесты (wip)

## Лицензия

MIT
