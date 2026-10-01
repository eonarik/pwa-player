// oxlint-disable vitest/require-mock-type-parameters
// src/services/persistence/SchemaService.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SchemaService } from './SchemaService'
import { SCHEMA_VERSION, SCHEMA_VERSION_KEY } from './schema'

// Хранилище в памяти для idb-keyval
const mockStorage = new Map<string, unknown>()

vi.mock('idb-keyval', () => ({
  createStore: () => ({}),
  get: vi.fn(async (key: string) => mockStorage.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    mockStorage.set(key, value)
  }),
  del: vi.fn(async (key: string) => {
    mockStorage.delete(key)
  }),
  clear: vi.fn(async () => {
    mockStorage.clear()
  }),
}))

describe('SchemaService', () => {
  let service: SchemaService

  beforeEach(() => {
    mockStorage.clear()
    vi.clearAllMocks()
    service = new SchemaService()
  })

  it('первый запуск: пишет версию, не чистит', async () => {
    mockStorage.set('some-key', 'some-value')

    const wasCleared = await service.ensureCompatible()

    expect(wasCleared).toBe(false)
    expect(mockStorage.get(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION)
    // Данные не стёрты
    expect(mockStorage.get('some-key')).toBe('some-value')
  })

  it('совпадающая версия: ничего не делает', async () => {
    mockStorage.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION)
    mockStorage.set('some-key', 'some-value')

    const wasCleared = await service.ensureCompatible()

    expect(wasCleared).toBe(false)
    expect(mockStorage.get('some-key')).toBe('some-value')
  })

  it('несовпадающая версия: чистит и пишет новую', async () => {
    mockStorage.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION - 1)
    mockStorage.set('some-key', 'some-value')

    const wasCleared = await service.ensureCompatible()

    expect(wasCleared).toBe(true)
    expect(mockStorage.get(SCHEMA_VERSION_KEY)).toBe(SCHEMA_VERSION)
    expect(mockStorage.get('some-key')).toBeUndefined()
  })

  it('clearAll удаляет всё', async () => {
    mockStorage.set('some-key', 'some-value')
    await service.clearAll()
    expect(mockStorage.size).toBe(0)
  })
})
