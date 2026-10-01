// src/composables/useMenu.spec.ts

import { describe, it, expect, afterEach } from 'vitest'
import { useMenu } from './useMenu'
import { withSetup } from '@/test/withSetup'

describe('useMenu', () => {
  let cleanup: (() => void) | null = null

  afterEach(() => {
    cleanup?.()
    cleanup = null
  })

  it('изначально закрыто', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    expect(result.isOpen.value).toBe(false)
  })

  it('toggle открывает и закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    result.toggle()
    expect(result.isOpen.value).toBe(true)

    result.toggle()
    expect(result.isOpen.value).toBe(false)
  })

  it('close закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    result.toggle()
    result.close()
    expect(result.isOpen.value).toBe(false)
  })

  it('клик вне rootRef закрывает', async () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    // Создаём root element и подкладываем в ref
    const root = document.createElement('div')
    document.body.appendChild(root)
    result.rootRef.value = root

    result.toggle()
    expect(result.isOpen.value).toBe(true)

    // Клик вне
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(result.isOpen.value).toBe(false)

    document.body.removeChild(root)
    document.body.removeChild(outside)
  })

  it('клик внутри rootRef не закрывает', async () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    const root = document.createElement('div')
    document.body.appendChild(root)
    result.rootRef.value = root

    result.toggle()
    expect(result.isOpen.value).toBe(true)

    // Клик внутри
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(result.isOpen.value).toBe(true)

    document.body.removeChild(root)
  })

  it('клик вне закрытого меню не падает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(result.isOpen.value).toBe(false)

    document.body.removeChild(outside)
  })
})
