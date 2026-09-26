import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { diskRouter } from './disk/routes.js'
import { authRouter } from './auth/routes.js'
import { configRouter } from './config/routes.js'
import { coverRouter } from './cover/routes.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cuei-player-server' })
})

app.use('/api', authRouter)
app.use('/api', configRouter)
app.use('/api', coverRouter)
app.use('/api/disk', diskRouter)

export default app

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 3000)
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
}
