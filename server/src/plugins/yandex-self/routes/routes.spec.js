// server/src/plugins/yandex-self/routes/routes.spec.js

// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import {
  yandexCreateFolder,
  yandexDeleteResource,
  yandexMoveResource,
  yandexGetUploadUrl,
} from '../../../shared/yandexApi.js';

// Сохраняем оригинальный fetch ДО моков (для запросов к локальному серверу).
const originalFetch = globalThis.fetch;

// Мокаем config (без похода на Яндекс.Диск).
vi.mock('../config.js', () => ({
  getSelfConfig: vi.fn(async () => ({
    contexts: { common: { password: '', folders: null } },
    common: { password: '', folders: null },
  })),
  invalidateSelfConfig: vi.fn(),
}));

// Мокаем yandexApi
vi.mock('../../../shared/yandexApi.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    yandexCreateFolder: vi.fn(async () => ({ status: 201 })),
    yandexDeleteResource: vi.fn(async () => ({ status: 204 })),
    yandexMoveResource: vi.fn(async () => ({ status: 201 })),
    yandexGetUploadUrl: vi.fn(async () => ({ href: 'https://upload.example.test/', method: 'PUT' })),
  };
});

// fetch-мок для PUT href внутри /upload.
const fetchMock = vi.fn();

// Импортируем роутер после моков. index.js лежит на уровень выше (в yandex-self/).
const { router: selfRouter } = await import('../index.js');

function makeRequest(app, method, path, { body, headers, session } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port;
      try {
        const finalHeaders = {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(session ? { 'X-Test-Session': JSON.stringify(session) } : {}),
          ...headers,
        };

        const res = await originalFetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers: finalHeaders,
          // oxlint-disable-next-line unicorn/no-invalid-fetch-options
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        const data = await res.json().catch(() => null);
        server.close(() => resolve({ status: res.status, data }));
      } catch (err) {
        server.close(() => reject(err));
      }
    });
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());

  // Ставим req.session ДО роутера.
  app.use((req, _res, next) => {
    const header = req.headers['x-test-session'];
    if (header) {
      try {
        req.session = { selfAuth: JSON.parse(header) };
      } catch {
        req.session = {};
      }
    } else {
      req.session = {};
    }
    next();
  });

  app.use('/api/yandex-self', selfRouter);

  app.use((err, _req, res, _next) => {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    res.status(status).json({ error: err?.message ?? 'Internal server error' });
  });

  return app;
}

const SESSION = { userId: 'common', allowedFolders: null };

describe('yandex-self: /auth/check', () => {
  it('401 без сессии', async () => {
    const res = await makeRequest(buildApp(), 'GET', '/api/yandex-self/auth/check');
    expect(res.status).toBe(401);
  });

  it('200 с валидной сессией', async () => {
    const res = await makeRequest(buildApp(), 'GET', '/api/yandex-self/auth/check', { session: SESSION });
    expect(res.status).toBe(200);
  });
});

describe('yandex-self: /auth', () => {
  it('200 + selfAuth в сессии', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/auth', {
      body: { ctx: 'common', password: '' },
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it('401 при неверном пароле', async () => {
    const { getSelfConfig } = await import('../config.js');
    vi.mocked(getSelfConfig).mockResolvedValueOnce({
      contexts: { common: { password: 'secret', folders: null } },
      common: { password: 'secret', folders: null },
    });

    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/auth', {
      body: { ctx: 'common', password: 'wrong' },
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toContain('Неверный пароль');
  });
});

describe('yandex-self: /auth/logout', () => {
  it('200 и сбрасывает selfAuth', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/logout', { session: SESSION });
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });
});

describe('yandex-self: POST /folder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 без сессии', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/folder', { body: { name: '1' } });
    expect(res.status).toBe(401);
  });

  it('400 без name', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/folder', {
      body: { path: '/' },
      session: SESSION,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('name is required');
  });

  it('200 — создаёт папку', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/folder', {
      body: { path: '/', name: 'logii.2024' },
      session: SESSION,
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(yandexCreateFolder).toHaveBeenCalledOnce();
    const call = yandexCreateFolder.mock.calls[0];
    expect(call).toBeDefined();
    expect(call[1]).toContain('logii.2024');
  });

  it('409 — папка уже существует', async () => {
    yandexCreateFolder.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { status: 409 }));
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/folder', {
      body: { path: '/', name: '1' },
      session: SESSION,
    });
    expect(res.status).toBe(409);
    expect(res.data.error).toContain('уже существует');
  });

  it('403 — путь вне allowedFolders', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/folder', {
      body: { path: '/Other', name: '1' },
      session: { userId: 'common', allowedFolders: ['/Music'] },
    });
    expect(res.status).toBe(403);
  });
});

describe('yandex-self: DELETE /resource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 без сессии', async () => {
    const res = await makeRequest(buildApp(), 'DELETE', '/api/yandex-self/resource?path=/Music/1');
    expect(res.status).toBe(401);
  });

  it('400 без path', async () => {
    const res = await makeRequest(buildApp(), 'DELETE', '/api/yandex-self/resource', { session: SESSION });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('path is required');
  });

  it('200 — удаляет', async () => {
    const res = await makeRequest(buildApp(), 'DELETE', '/api/yandex-self/resource?path=/Music/1', {
      session: SESSION,
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(yandexDeleteResource).toHaveBeenCalledOnce();
  });

  it('404 — ресурс не найден', async () => {
    yandexDeleteResource.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    const res = await makeRequest(buildApp(), 'DELETE', '/api/yandex-self/resource?path=/Music/1', {
      session: SESSION,
    });
    expect(res.status).toBe(404);
  });

  it('403 — путь вне allowedFolders', async () => {
    const res = await makeRequest(buildApp(), 'DELETE', '/api/yandex-self/resource?path=/Other/1', {
      session: { userId: 'common', allowedFolders: ['/Music'] },
    });
    expect(res.status).toBe(403);
  });
});

describe('yandex-self: POST /move', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 без сессии', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/a', toPath: '/b' },
    });
    expect(res.status).toBe(401);
  });

  it('400 без fromPath/toPath', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/a' },
      session: SESSION,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('fromPath and toPath');
  });

  it('200 — переименовывает', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/logii.2024/userA', toPath: '/logii.2024/userB' },
      session: SESSION,
    });
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(yandexMoveResource).toHaveBeenCalledOnce();
  });

  it('409 — целевой ресурс существует', async () => {
    yandexMoveResource.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { status: 409 }));
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/a', toPath: '/b' },
      session: SESSION,
    });
    expect(res.status).toBe(409);
  });

  it('404 — исходный ресурс не найден', async () => {
    yandexMoveResource.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }));
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/a', toPath: '/b' },
      session: SESSION,
    });
    expect(res.status).toBe(404);
  });

  it('403 — fromPath вне allowedFolders', async () => {
    const res = await makeRequest(buildApp(), 'POST', '/api/yandex-self/move', {
      body: { fromPath: '/Other/a', toPath: '/Music/b' },
      session: { userId: 'common', allowedFolders: ['/Music'] },
    });
    expect(res.status).toBe(403);
  });
});

describe('yandex-self: PUT /upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('401 без сессии', async () => {
    const res = await makeRequest(buildApp(), 'PUT', '/api/yandex-self/upload?path=/Music/1&name=track.mp3');
    expect(res.status).toBe(401);
  });

  it('400 без path/name', async () => {
    const res = await makeRequest(buildApp(), 'PUT', '/api/yandex-self/upload?path=/Music/1', {
      session: SESSION,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('path and name');
  });

  it('200 — загружает файл (через yandexGetUploadUrl + fetch PUT)', async () => {
    const app = buildApp();

    const res = await new Promise((resolve, reject) => {
      const server = http.createServer(app);
      server.listen(0, '127.0.0.1', async () => {
        const port = server.address().port;
        try {
          const response = await originalFetch(
            `http://127.0.0.1:${port}/api/yandex-self/upload?path=${encodeURIComponent('/Music/1')}&name=track.mp3`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'audio/mpeg',
                'X-Test-Session': JSON.stringify(SESSION),
              },
              body: Buffer.from('fake-mp3-data'),
            },
          );
          const data = await response.json().catch(() => null);
          server.close(() => resolve({ status: response.status, data }));
        } catch (err) {
          server.close(() => reject(err));
        }
      });
    });

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(yandexGetUploadUrl).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    expect(call[0]).toContain('upload.example.test');
  });

  it('403 — путь вне allowedFolders', async () => {
    const res = await makeRequest(
      buildApp(),
      'PUT',
      `/api/yandex-self/upload?path=${encodeURIComponent('/Other/1')}&name=track.mp3`,
      {
        session: { userId: 'common', allowedFolders: ['/Music'] },
        headers: { 'Content-Type': 'audio/mpeg' },
      },
    );
    expect(res.status).toBe(403);
  });
});
