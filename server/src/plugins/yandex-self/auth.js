// server/src/plugins/yandex-self/auth.js
import crypto from 'node:crypto'
import { getSelfConfig } from './config.js'

const SECRET = process.env.SESSION_SECRET || 'yandex-self-secret'

// Время жизни access-токена: 15 минут (для нормальной работы)
const ACCESS_TTL = 15 * 60 * 1000
// Время жизни refresh-токена: 30 дней
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000

function signToken(payload) {
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  return `${payloadStr}.${signature}`
}

function verifyToken(token) {
  if (!token) return null
  const [payloadStr, signature] = token.split('.')
  if (!payloadStr || !signature) return null

  const expected = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  try {
    return JSON.parse(Buffer.from(payloadStr, 'base64url').toString())
  } catch {
    return null
  }
}

export async function login(ctx, password) {
  const config = await getSelfConfig()
  let targetConfig = null

  if (ctx && config.contexts[ctx]) {
    targetConfig = config.contexts[ctx]
  } else if (config.common) {
    targetConfig = config.common
  }

  if (!targetConfig) throw new Error('Контекст не найден и общий доступ не настроен')
  if (targetConfig.password && password !== targetConfig.password)
    throw new Error('Неверный пароль')

  const allowedFolders = targetConfig.folders === undefined ? null : targetConfig.folders
  const userId = ctx || 'common'

  // Генерируем пару токенов
  const accessToken = signToken({ ctx: userId, allowedFolders, exp: Date.now() + ACCESS_TTL })
  const refreshToken = signToken({
    ctx: userId,
    allowedFolders,
    type: 'refresh',
    exp: Date.now() + REFRESH_TTL,
  })

  return { accessToken, refreshToken, allowedFolders }
}

export function validateToken(token) {
  const payload = verifyToken(token)
  if (!payload || payload.type === 'refresh') return null
  if (payload.exp < Date.now()) return null
  return payload
}

export async function refresh(refreshToken) {
  const payload = verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh') throw new Error('Invalid refresh token')
  if (payload.exp < Date.now()) throw new Error('Refresh token expired')

  // Выдаем новый access-токен (refresh-токен не трогаем, он долгоживущий)
  const accessToken = signToken({
    ctx: payload.ctx,
    allowedFolders: payload.allowedFolders,
    exp: Date.now() + ACCESS_TTL,
  })

  return { accessToken, allowedFolders: payload.allowedFolders }
}
