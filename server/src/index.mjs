// server/src/index.mjs

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { sessionMiddleware } from './core/session.js'
import { passport } from './core/passport.js'
import { mountModules } from './modules.js'
import { logger } from './shared/logger.js'

const app = express()

// За Nginx: req.ip = реальный IP клиента (для rate limit feedback)
app.set('trust proxy', 1)

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cuei-player-server', version: '0.4.0' })
})

mountModules(app)

// Централизованный error handler — после всех модулей
app.use((err, _req, res, _next) => {
  const status = Number.isFinite(err?.status) ? err.status : 500
  logger.error(`[server] ${status}: ${err?.message ?? err}`)
  res.status(status).json({ error: err?.message ?? 'Internal server error' })
})

export default app

const PORT = Number(process.env.PORT ?? 3000)
app.listen(PORT, () => {
  logger.info(`[server] listening on http://localhost:${PORT}`)
})
