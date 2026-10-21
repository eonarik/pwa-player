// server/src/plugins/yandex-self/auth.js
import crypto from 'node:crypto'
import { getSelfConfig } from './config.js'

const SECRET = process.env.SESSION_SECRET || 'yandex-self-secret'
const TOKEN_TTL = 24 * 60 * 60 * 1000

export async function login(ctx, password) {
  const config = await getSelfConfig()

  // Если ctx передан и существует — проверяем его
  let targetConfig = null
  if (ctx && config.contexts[ctx]) {
    targetConfig = config.contexts[ctx]
  } else if (config.common) {
    // Если ctx неверный, или его нет — проверяем common
    targetConfig = config.common
  }

  if (!targetConfig) {
    throw new Error('Контекст не найден и общий доступ не настроен')
  }

  if (targetConfig.password && password !== targetConfig.password) {
    throw new Error('Неверный пароль')
  }

  // ВАЖНО: сохраняем folders как есть (может быть null, [] или массив)
  const payload = {
    ctx: ctx || 'common',
    allowedFolders: targetConfig.folders === undefined ? null : targetConfig.folders,
    exp: Date.now() + TOKEN_TTL,
  }

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  const token = `${payloadStr}.${signature}`

  return { token, allowedFolders: payload.allowedFolders }
}

export function validateToken(token) {
  if (!token) return null
  const [payloadStr, signature] = token.split('.')
  if (!payloadStr || !signature) return null

  const expected = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')

  // Constant-time comparison
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return null
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
