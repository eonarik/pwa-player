// server/src/auth/jwt.ts

import crypto from 'node:crypto'

const SECRET = process.env.AUTH_SECRET ?? 'insecure-default-change-me'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней

interface TokenPayload {
  exp: number
}

export function createToken(): string {
  const payload: TokenPayload = {
    exp: Date.now() + TTL_MS,
  }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')
  return `${payloadStr}.${signature}`
}

export function validateToken(token: string): boolean {
  const [payloadStr, signature] = token.split('.')
  if (!payloadStr || !signature) return false

  const expected = crypto.createHmac('sha256', SECRET).update(payloadStr).digest('base64url')

  if (signature !== expected) return false

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString()) as TokenPayload
    return payload.exp > Date.now()
  } catch {
    return false
  }
}
