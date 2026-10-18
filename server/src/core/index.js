// server/src/core/index.js

import { coreRouter } from './routes.js'
import { requireSession } from './middleware/requireSession.js'

export const router = coreRouter
export { requireSession }
export const prefix = '/api/auth'
