// server/src/plugins/yandex-self/routes/download.js

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { resolveRequestPath } from '../middleware/access.js';
import { yandexDownloadHref } from '../../../shared/yandexApi.js';

export const downloadRoutes = Router();

downloadRoutes.get('/download', requireAuth, async (req, res) => {
  const ctx = resolveRequestPath(req, res, req.query.path);
  if (!ctx) return;

  try {
    // 1. Получаем ссылку (с ретраями)
    let href = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        href = await yandexDownloadHref(process.env.YANDEX_SELF_TOKEN, ctx.fullPath);
        if (href) break;
      } catch (err) {
        if (err.status === 404) throw err;
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!href) {
      res.status(404).json({ error: 'Download link not found' });
      return;
    }

    // 2. Скачиваем файл (с ретраями)
    let fileResponse = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let timeoutId;
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 15000);

        fileResponse = await fetch(href, {
          headers: { Connection: 'close' },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (fileResponse.ok) break;

        if (fileResponse.status === 404 || fileResponse.status === 410) {
          res.status(404).json({ error: 'File not found on Yandex Disk' });
          return;
        }

        if (fileResponse.status >= 500) throw new Error(`Yandex HTTP ${fileResponse.status}`);
        break;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!fileResponse || !fileResponse.ok || !fileResponse.body) {
      res.status(502).json({ error: 'Failed to fetch file from Yandex (Network Error)' });
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
    console.error(`[yandex-self] Download error for "${req.query.path}":`, err.message);

    if (res.headersSent || res.writableEnded) {
      res.destroy();
      return;
    }

    if (err.status === 404 || err.name === 'NotFoundError') {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (err.cause?.code === 'ETIMEDOUT' || err.cause?.code === 'ENETUNREACH' || err.message === 'fetch failed') {
      res.status(502).json({ error: 'Network error while fetching from Yandex' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});
