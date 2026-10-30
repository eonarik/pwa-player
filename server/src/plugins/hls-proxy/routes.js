// server/src/plugins/hls-proxy/routes.js

import { Router } from 'express';

export const hlsProxyRoutes = Router();

const PROXY_PATH = '/api/hls-proxy';
const MAX_MANIFEST_SIZE = 5 * 1024 * 1024; // 5 МБ на манифест (это много, m3u8 весит пару КБ)
const TIMEOUT_MS = 15000;

/**
 * Переписывает относительные и абсолютные ссылки в m3u8 на наш прокси.
 */
function rewriteManifest(text, baseUrl) {
  const base = new URL(baseUrl);

  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      // Обработка #EXT-X-KEY, #EXT-X-MAP и подобных тегов с URI="..."
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
          try {
            const abs = new URL(uri, base).toString();
            return `URI="${PROXY_PATH}?url=${encodeURIComponent(abs)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      // Комментарии и пустые строки оставляем как есть
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }

      // Строка — ссылка на сегмент
      try {
        const abs = new URL(trimmed, base).toString();
        return `${PROXY_PATH}?url=${encodeURIComponent(abs)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

hlsProxyRoutes.get('/hls-proxy', async (req, res) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  if (!raw) {
    return res.status(400).json({ error: 'url is required' });
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'only http(s) urls are allowed' });
  }

  // CORS для фронта (чтобы hls.js мог читать)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'CUEI/1.0 (HLS Proxy)',
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status).json({ error: `Upstream HTTP ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isManifest =
      target.pathname.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('vnd.apple');

    if (isManifest) {
      const text = await upstream.text();
      if (text.length > MAX_MANIFEST_SIZE) {
        return res.status(413).json({ error: 'manifest too large' });
      }

      const rewritten = rewriteManifest(text, target.toString());
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(rewritten);
    }

    // Бинарный сегмент (ts, key, aac и т.д.) — стримим потоком
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, max-age=60');

    const reader = upstream.body.getReader();
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
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'timeout' });
    }
    console.error('[hls-proxy] error:', err);
    res.status(502).json({ error: 'proxy failed' });
  }
});
