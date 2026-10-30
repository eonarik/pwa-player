// server/src/plugins/zvuk/routes.js

import { Router } from 'express';
import { searchAll, getStreamUrl, searchMetadataStrict } from './service.js';
import { Readable } from 'stream';

export const zvukRoutes = Router();

zvukRoutes.get('/search', async (req, res) => {
  const query = req.query.q;
  const typesRaw = typeof req.query.types === 'string' ? req.query.types : 'tracks';
  const types = typesRaw.split(',');
  const userToken = req.headers['x-zvuk-token'];

  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const data = await searchAll(query, types, userToken);
    res.json(data);
  } catch (err) {
    console.error('[zvuk] search error:', err);
    res.status(500).json({ error: err.message });
  }
});

zvukRoutes.get('/metadata', async (req, res) => {
  const { artist, title } = req.query;
  const userToken = req.headers['x-zvuk-token'];

  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const result = await searchMetadataStrict(artist, title, userToken);
    res.json(result);
  } catch (err) {
    console.error('[zvuk] metadata search error:', err);
    res.status(500).json({ error: err.message });
  }
});

zvukRoutes.get('/stream', async (req, res) => {
  const id = req.query.id;
  const userToken = req.headers['x-zvuk-token'];
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const url = await getStreamUrl(Number(id), userToken);

    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status).json({ error: 'Failed to fetch stream' });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstream.headers.get('content-length');
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Accept-Ranges', 'bytes');

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[zvuk] stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.destroy();
    }
  }
});
