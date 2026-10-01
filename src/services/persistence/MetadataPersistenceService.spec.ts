// oxlint-disable vitest/require-mock-type-parameters
// src/services/persistence/MetadataPersistenceService.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MetadataPersistenceService } from './MetadataPersistenceService'
import type { OriginalMetadata } from './MetadataPersistenceService'

// Мокаем idb-keyval полностью
vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}))

/**
 * Создаём свой экземпляр сервиса (не singleton),
 * чтобы тесты не влияли друг на друга.
 */
function createService(): MetadataPersistenceService {
  return new MetadataPersistenceService()
}

const ORIGINAL: OriginalMetadata = {
  artist: 'Original Artist',
  title: 'Original Title',
  album: 'Original Album',
  coverUrl: undefined,
  coverUrlWasBlob: false,
}

describe('MetadataPersistenceService', () => {
  let service: MetadataPersistenceService

  beforeEach(() => {
    service = createService()
    vi.clearAllMocks()
  })

  it('изначально пусто', () => {
    expect(service.get('track:1')).toBeUndefined()
    expect(service.has('track:1')).toBe(false)
  })

  it('setInMemory сохраняет и возвращает', () => {
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: 'https://cover',
      similarity: 0.9,
      original: ORIGINAL,
    })

    const entry = service.get('track:1')
    expect(entry).toBeDefined()
    expect(entry!.artist).toBe('A')
    expect(entry!.similarity).toBe(0.9)
    expect(entry!.original).toEqual(ORIGINAL)
  })

  it('has возвращает true после setInMemory', () => {
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: null,
      similarity: null,
      original: null,
    })

    expect(service.has('track:1')).toBe(true)
  })

  it('setInMemory перезаписывает', () => {
    service.setInMemory('track:1', {
      artist: 'A1',
      title: 'T1',
      album: 'Al1',
      coverUrl: null,
      similarity: null,
      original: null,
    })
    service.setInMemory('track:1', {
      artist: 'A2',
      title: 'T2',
      album: 'Al2',
      coverUrl: null,
      similarity: null,
      original: null,
    })

    expect(service.get('track:1')!.artist).toBe('A2')
  })

  it('resetForTracks удаляет записи', async () => {
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: null,
      similarity: null,
      original: null,
    })

    await service.resetForTracks(['track:1'])
    expect(service.get('track:1')).toBeUndefined()
  })

  it('resetForTracks не трогает другие треки', async () => {
    service.setInMemory('track:1', {
      artist: 'A1',
      title: 'T1',
      album: 'Al1',
      coverUrl: null,
      similarity: null,
      original: null,
    })
    service.setInMemory('track:2', {
      artist: 'A2',
      title: 'T2',
      album: 'Al2',
      coverUrl: null,
      similarity: null,
      original: null,
    })

    await service.resetForTracks(['track:1'])
    expect(service.get('track:1')).toBeUndefined()
    expect(service.get('track:2')).toBeDefined()
  })

  it('TTL на "не найдено" (artist = null)', async () => {
    service.setInMemory('track:1', {
      artist: null,
      title: null,
      album: null,
      coverUrl: null,
      similarity: null,
      original: null,
    })

    // Перематываем время на 8 дней вперёд
    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 8 * 24 * 60 * 60 * 1000)

    expect(service.get('track:1')).toBeUndefined()

    vi.spyOn(Date, 'now').mockRestore()
  })

  it('TTL не влияет на "найдено"', async () => {
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: 'https://cover',
      similarity: 0.9,
      original: null,
    })

    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 30 * 24 * 60 * 60 * 1000)

    expect(service.get('track:1')).toBeDefined()

    vi.spyOn(Date, 'now').mockRestore()
  })

  it('clear очищает всё', async () => {
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: null,
      similarity: null,
      original: null,
    })
    await service.clear()
    expect(service.size()).toBe(0)
  })

  it('flush вызывает persist', async () => {
    const idb = await import('idb-keyval')
    service.setInMemory('track:1', {
      artist: 'A',
      title: 'T',
      album: 'Al',
      coverUrl: null,
      similarity: null,
      original: null,
    })
    await service.flush()
    expect(idb.set).toHaveBeenCalled()
  })
})
