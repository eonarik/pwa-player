// server/src/plugins/yandex-self/index.js

import { Router } from 'express'
import { selfRoutes } from './routes.js'

export const router = Router()
router.use(selfRoutes)

export const prefix = '/api/yandex-self'
