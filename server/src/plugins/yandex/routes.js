// server/src/plugins/yandex/routes.js
import { Router } from 'express';
import { requireSession } from '../../core/index.js';
import { YandexApiError } from '../../shared/errors.js';
import {
  yandexListResources,
  yandexDownloadHref,
  yandexResourceMeta,
  yandexDownloadText,
  yandexUploadText,
} from '../../shared/yandexApi.js';
import { resolveDiskPath, toClientPath } from './service.js';
import { isAudioFile } from '../../shared/audio.js';

export const yandexRoutes = Router();
yandexRoutes.use(requireSession);

// Кеш реального пути папки приложения на Диске.
// Яндекс возвращает элементы с полными путями (disk:/Приложения/...),
// а мы должны отдавать фронтенду пути относительно app:/ (например, 'music').
let appRealRoot = null;

yandexRoutes.get('/resources', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '/';
  const token = req.user.accessToken;

  try {
    const path = resolveDiskPath(clientPath);
    const data = await yandexListResources(token, path);

    // Если запрашиваем корень app:/, запоминаем его реальный путь на Диске.
    // Например, data.path будет 'disk:/Приложения/CUEI media player dev'
    if (path === 'app:/' && data.path) {
      appRealRoot = data.path;
    }

    // Преобразуем элементы
    let items = (data._embedded?.items || []).map((item) => {
      let itemPath = item.path;

      // Отрезаем реальный путь приложения от пути элемента
      if (appRealRoot && itemPath.startsWith(appRealRoot)) {
        itemPath = itemPath.slice(appRealRoot.length);
        if (itemPath.startsWith('/')) itemPath = itemPath.slice(1);
      } else if (itemPath.startsWith('disk:/')) {
        // Fallback: если по какой-то причине appRealRoot еще не установлен,
        // хотя бы отрезаем 'disk:/', чтобы не было дубля.
        itemPath = itemPath.replace('disk:/', '');
      }

      return {
        ...item,
        path: itemPath, // Теперь это 'music' или 'music/Artist A'
        isAudio: item.type === 'file' && isAudioFile(item.name),
      };
    });

    data._embedded = { ...data._embedded, items };
    data.total = items.length;
    data.path = clientPath;
    data.items = items;

    res.json(data);
  } catch (err) {
    if (err instanceof YandexApiError) {
      const status = Number.isFinite(err.status) ? err.status : 500;
      res.status(status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

yandexRoutes.get('/download', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }

  try {
    const path = resolveDiskPath(clientPath);
    const href = await yandexDownloadHref(req.user.accessToken, path);
    if (!href) {
      res.status(404).json({ error: 'Download link not found' });
      return;
    }

    const fileResponse = await fetch(href);
    if (!fileResponse.ok || !fileResponse.body) {
      res.status(fileResponse.status).json({ error: 'Failed to fetch file' });
      return;
    }

    const contentType = fileResponse.headers.get('Content-Type') || 'audio/mpeg';
    const contentLength = fileResponse.headers.get('Content-Length');
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const reader = fileResponse.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      return pump();
    };
    await pump();
  } catch (err) {
    if (res.headersSent || res.writableEnded) {
      res.destroy();
      return;
    }
    next(err);
  }
});

yandexRoutes.get('/text', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }

  try {
    const path = resolveDiskPath(clientPath);
    const meta = await yandexResourceMeta(req.user.accessToken, path);
    const content = await yandexDownloadText(req.user.accessToken, path);

    res.json({
      content: content ?? '',
      modified: meta.modified ?? null,
      size: meta.size ?? null,
    });
  } catch (err) {
    next(err);
  }
});

yandexRoutes.put('/text', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : null;
  if (content === null) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  try {
    const path = resolveDiskPath(clientPath);
    await yandexUploadText(req.user.accessToken, path, content);
    const meta = await yandexResourceMeta(req.user.accessToken, path);
    res.json({ ok: true, modified: meta.modified ?? null });
  } catch (err) {
    next(err);
  }
});

// Error handler
yandexRoutes.use((err, _req, res, _next) => {
  if (err instanceof YandexApiError) {
    const status = Number.isFinite(err.status) ? err.status : 500;
    console.error(`[yandex] API error ${status}: ${err.message}`);
    res.status(status).json({ error: err.message });
    return;
  }
  console.error('[yandex] unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
