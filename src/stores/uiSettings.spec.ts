// oxlint-disable vitest/require-mock-type-parameters
// src/stores/uiSettings.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiSettingsStore } from './uiSettings'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
}))

describe('useUiSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('дефолты', () => {
    const store = useUiSettingsStore()
    expect(store.showSource).toBe(false)
    expect(store.showFiles).toBe(false)
    expect(store.metadataThreshold).toBe(0.5)
    expect(store.searchThreshold).toBe(0.5)
  })

  it('showFiles по умолчанию false', () => {
    const store = useUiSettingsStore()
    expect(store.showFiles).toBe(false)
  })

  it('toggleShowSource', () => {
    const store = useUiSettingsStore()
    store.toggleShowSource()
    expect(store.showSource).toBe(true)
    store.toggleShowSource()
    expect(store.showSource).toBe(false)
  })

  it('setMetadataThreshold валидирует 0..1', () => {
    const store = useUiSettingsStore()

    store.setMetadataThreshold(0.7)
    expect(store.metadataThreshold).toBe(0.7)

    store.setMetadataThreshold(-1)
    expect(store.metadataThreshold).toBe(0)

    store.setMetadataThreshold(2)
    expect(store.metadataThreshold).toBe(1)
  })

  it('setSearchThreshold валидирует 0..1', () => {
    const store = useUiSettingsStore()

    store.setSearchThreshold(0.9)
    expect(store.searchThreshold).toBe(0.9)

    store.setSearchThreshold(-0.5)
    expect(store.searchThreshold).toBe(0)

    store.setSearchThreshold(5)
    expect(store.searchThreshold).toBe(1)
  })
})
