// src/services/library/migrations.spec.ts

import { describe, it, expect } from 'vitest'
import { migrateFileLocation, migrateScanState } from './migrations'

describe('migrateFileLocation', () => {
  it('downloaded → both', () => {
    expect(migrateFileLocation('downloaded')).toBe('both')
  })
  it('only-local → local-only', () => {
    expect(migrateFileLocation('only-local')).toBe('local-only')
  })
  it('remote → remote-only', () => {
    expect(migrateFileLocation('remote')).toBe('remote-only')
  })
  it('undefined → remote-only', () => {
    expect(migrateFileLocation(undefined)).toBe('remote-only')
  })
  it('null → remote-only', () => {
    expect(migrateFileLocation(null)).toBe('remote-only')
  })
})

describe('migrateScanState', () => {
  it('scanned → scanned', () => {
    expect(migrateScanState('scanned')).toBe('scanned')
  })
  it('scanning → scanning', () => {
    expect(migrateScanState('scanning')).toBe('scanning')
  })
  it('undefined → pending', () => {
    expect(migrateScanState(undefined)).toBe('pending')
  })
  it('null → pending', () => {
    expect(migrateScanState(null)).toBe('pending')
  })
})
