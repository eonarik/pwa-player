// server/src/auth/jwt.js

import crypto from 'node:crypto'

const DEFAULT_INSECURE_SECRET = 'insecure-default-change-me'

function resolveSecret() {
  const secret = process.env.AUTH_SECRET

  if (secret && secret.length > 0) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] AUTH_SECRET is required in production. ' + 'Set it in .env: `openssl rand -hex 32`.',
    )
  }

  // DEV/TEST: разрешаем дефолт, но предупреждаем
  console.warn(
    '[auth] AUTH_SECRET is not set. Using insecure default. ' +
      'This is OK for local development only.',
  )
  return DEFAULT_INSECURE_SECRET
}

const SECRET = resolveSecret()
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней

export function createToken() {
  const payload = {
    exp: Date.now() + TTL_MS,
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  return `${payloadStr}.${signature}`
}

export function validateToken(token) {
  const [payloadStr, signature] = token.split('.')
  if (!payloadStr || !signature) return false

  const expected = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')

  // Constant-time сравнение, чтобы не утекала длина совпадающего префикса
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString())
    if (typeof payload.exp !== 'number') return false
    return payload.exp > Date.now()
  } catch {
    return false
  }
}
