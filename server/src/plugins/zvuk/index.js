// server/src/plugins/zvuk/index.js
import { Router } from 'express'
import { zvukRoutes } from './routes.js'

export const router = Router()
router.use(zvukRoutes)
export const prefix = '/api/zvuk'
