// server/src/plugins/yandex-self/auth.js
import crypto from 'node:crypto'
import { getSelfConfig } from './config.js'

const SECRET = process.env.SESSION_SECRET || 'yandex-self-secret'

// TODO: Вернуть ACCESS_TTL на 15 минут и починить рефреш токенов на фронте
// (сейчас handleStreamError не обновляет токен при 401 от <audio>).
// Временно: 30 суток, чтобы сессия жила долго без рефреша.
const ACCESS_TTL = 30 * 24 * 60 * 60 * 1000 // 30 дней
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

  const accessToken = signToken({
    ctx: payload.ctx,
    allowedFolders: payload.allowedFolders,
    exp: Date.now() + ACCESS_TTL,
  })

  return { accessToken, allowedFolders: payload.allowedFolders }
}
