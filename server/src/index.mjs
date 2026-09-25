// server/src/index.ts

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { diskRouter } from './disk/routes.js'

const PORT = Number(process.env.PORT ?? 3000)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'

if (!process.env.YANDEX_TOKEN) {
  console.error('[server] YANDEX_TOKEN is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const app = express()

// CORS только для фронта — не используем origin: true или '*'
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  }),
)

app.use(express.json())

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cuei-player-server' })
})

// API Яндекс.Диска
app.use('/api/disk', diskRouter)

/**
 * GET /api/config
 * Отдаёт публичную конфигурацию прокси.
 * Токен сюда НЕ попадает.
 */
app.get('/api/config', (_req, res) => {
  res.json({
    musicPath: process.env.YANDEX_MUSIC_PATH ?? '/',
  })
})

// Экспорт для serverless (Vercel, Netlify Functions и т.д.)
export default app

// Локальный запуск — только если не в Vercel
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 3000)
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
}
