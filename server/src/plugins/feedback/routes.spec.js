// server/src/plugins/feedback/routes.spec.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import { feedbackRoutes, __clearRateLimit } from './routes.js';

// Мокаем mailer
vi.mock('./mailer.js', () => ({
  sendFeedbackMail: vi.fn(async () => ({ messageId: 'test' })),
}));

function makeRequest(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          // oxlint-disable-next-line unicorn/no-invalid-fetch-options
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        server.close(() => resolve({ status: res.status, data }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

describe('feedback routes', () => {
  let app;

  beforeEach(() => {
    __clearRateLimit(); // сбрасываем лимит перед каждым тестом

    app = express();
    app.use(express.json());

    // 1. Подменяем IP (через defineProperty, так как req.ip - геттер)
    app.use((req, _res, next) => {
      Object.defineProperty(req, 'ip', {
        value: '127.0.0.1',
        configurable: true,
      });
      next();
    });

    // 2. Роуты
    app.use('/api/feedback', feedbackRoutes);

    // 3. Error handler (ОБЯЗАТЕЛЬНО после роутов)
    app.use((err, _req, res, _next) => {
      const status = Number.isFinite(err?.status) ? err.status : 500;
      res.status(status).json({ error: err?.message ?? 'Internal server error' });
    });
  });

  it('400 если нет message', async () => {
    const res = await makeRequest(app, 'POST', '/api/feedback', {});
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('message is required');
  });

  it('200 если message есть', async () => {
    const res = await makeRequest(app, 'POST', '/api/feedback', { message: 'Тест' });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it('429 при rate limit', async () => {
    await makeRequest(app, 'POST', '/api/feedback', { message: 'Тест 1' });
    const res = await makeRequest(app, 'POST', '/api/feedback', { message: 'Тест 2' });
    expect(res.status).toBe(429);
    expect(res.data.error).toContain('Слишком часто');
  });
});
