// src/composables/useMenu.spec.ts

import { describe, it, expect, afterEach } from 'vitest'
import { useMenu } from './useMenu'
import { withSetup } from '@/test/withSetup'

describe('useMenu', () => {
  let cleanup: (() => void) | null = null
  let trigger: HTMLButtonElement | null = null

  afterEach(() => {
    cleanup?.()
    cleanup = null
    if (trigger && trigger.parentNode) {
      trigger.parentNode.removeChild(trigger)
    }
    trigger = null
  })

  function setupTrigger(result: ReturnType<typeof useMenu>): HTMLButtonElement {
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    // getBoundingClientRect в jsdom возвращает нули, но это ок — нам важна логика
    btn.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 40,
        width: 100,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    result.setTriggerRef(btn)
    return btn
  }

  it('изначально закрыто', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    expect(result.isOpen.value).toBe(false)
  })

  it('toggle открывает и закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    trigger = setupTrigger(result)

    result.toggle()
    expect(result.isOpen.value).toBe(true)

    result.toggle()
    expect(result.isOpen.value).toBe(false)
  })

  it('open открывает, close закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    expect(result.isOpen.value).toBe(true)

    result.close()
    expect(result.isOpen.value).toBe(false)
  })

  it('computePosition: align=right выравнивает по правому краю кнопки', () => {
    const { result, unmount } = withSetup(() => useMenu({ width: 200, align: 'right' }))
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    // rect.right = 100, width = 200 → left = 100 - 200 = -100
    // clamp по левому краю → 8
    expect(result.position.value.left).toBe(8)
    // top = rect.bottom + offset = 40 + 4 = 44
    expect(result.position.value.top).toBe(44)
  })

  it('computePosition: align=left выравнивает по левому краю кнопки', () => {
    const { result, unmount } = withSetup(() => useMenu({ width: 200, align: 'left' }))
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    // rect.left = 0
    expect(result.position.value.left).toBe(8) // clamp по EDGE_MARGIN
  })

  it('Esc закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    expect(result.isOpen.value).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(result.isOpen.value).toBe(false)
  })

  it('клик вне триггера закрывает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    expect(result.isOpen.value).toBe(true)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(result.isOpen.value).toBe(false)

    document.body.removeChild(outside)
  })

  it('клик по триггеру не закрывает (обрабатывается toggle)', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount
    trigger = setupTrigger(result)

    result.open()
    expect(result.isOpen.value).toBe(true)

    trigger!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(result.isOpen.value).toBe(true)
  })

  it('клик вне закрытого меню не падает', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    expect(() => outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow()
    document.body.removeChild(outside)

    expect(result.isOpen.value).toBe(false)
  })

  it('setTriggerRef принимает null', () => {
    const { result, unmount } = withSetup(() => useMenu())
    cleanup = unmount

    expect(() => result.setTriggerRef(null)).not.toThrow()
    expect(result.triggerRef.value).toBeNull()
  })
})
