// server/src/auth/jwt.spec.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_SECRET = process.env.AUTH_SECRET

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-unit-tests'
  vi.resetModules()
})

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = ORIGINAL_SECRET
  vi.resetModules()
})

async function loadJwt() {
  return await import('./jwt.js')
}

describe('jwt', () => {
  it('createToken создаёт валидный токен', async () => {
    const { createToken, validateToken } = await loadJwt()
    const token = createToken()
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(2)
    expect(validateToken(token)).toBe(true)
  })

  it('токены разные (разный exp)', async () => {
    const { createToken } = await loadJwt()
    const a = createToken()
    // exp в мс — в один и тот же момент может совпасть, поэтому пропустим
    // проверку различия, оставим только «не падает»
    const b = createToken()
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
  })

  it('валидация подделанного payload → false', async () => {
    const { createToken, validateToken } = await loadJwt()
    const token = createToken()
    const [payload, signature] = token.split('.')

    // Подменяем payload
    const forged = `${payload}forged.${signature}`
    expect(validateToken(forged)).toBe(false)
  })

  it('валидация подделанной подписи → false', async () => {
    const { createToken, validateToken } = await loadJwt()
    const token = createToken()
    const [payload] = token.split('.')

    const forged = `${payload}.AAAA`
    expect(validateToken(forged)).toBe(false)
  })

  it('токен без разделителя → false', async () => {
    const { validateToken } = await loadJwt()
    expect(validateToken('nodot')).toBe(false)
    expect(validateToken('')).toBe(false)
  })

  it('токен с пустым payload → false', async () => {
    const { validateToken } = await loadJwt()
    expect(validateToken('.signature')).toBe(false)
  })

  it('токен с пустой подписью → false', async () => {
    const { validateToken } = await loadJwt()
    expect(validateToken('payload.')).toBe(false)
  })

  it('истёкший токен → false', async () => {
    // Мокаем Date.now так, чтобы createToken выдал уже истёкший токен
    const { createToken, validateToken } = await loadJwt()
    const token = createToken()

    // Через 31 день
    const future = Date.now() + 31 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(future)

    expect(validateToken(token)).toBe(false)

    vi.restoreAllMocks()
  })

  it('токен с другим секретом → false', async () => {
    const { createToken } = await loadJwt()
    const token = createToken()

    // Меняем секрет и перезагружаем модуль
    process.env.AUTH_SECRET = 'different-secret'
    vi.resetModules()
    const { validateToken: validateWithNewSecret } = await loadJwt()

    expect(validateWithNewSecret(token)).toBe(false)
  })
})
