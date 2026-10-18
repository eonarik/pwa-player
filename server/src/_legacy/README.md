# Legacy (0.3.x) — для плагина `logii` (0.5.0)

Эти файлы **не используются** в 0.4.0. Они сохранены как reference для плагина `logii`,
который будет реализовывать приватный Яндекс.Диск (личный диск + `.settings.json` + JWT).

Не импортировать из активного кода. Не монтировать в `modules.js`.

- `settings/client.js` — `.settings.json`, `publicFolders`, `isPathPublic`, `getMusicRootPath`
- `middleware/requireAuth.js` — `checkAccess` (JWT + public folders)
- `auth/jwt.js` — HMAC-токены, `AUTH_SECRET`
- `auth/routes.js` — `POST /api/auth`, `GET /api/auth/check`
- `disk/filter.js` — фильтрация публичных папок
- `disk/paths.js` — `resolveDiskPath` / `toClientPath` (от `YANDEX_MUSIC_PATH`)
- `disk/normalize.js` — нормализация клиентских путей
- `config/routes.js` — `GET /api/config` → `{ hasSettings, publicFolders }`
