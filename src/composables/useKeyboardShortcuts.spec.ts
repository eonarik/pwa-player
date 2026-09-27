// src/composables/useKeyboardShortcuts.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { withSetup } from '@/test/withSetup'

interface Callbacks {
  onToggle: ReturnType<typeof vi.fn<() => void>>
  onToggleMute: ReturnType<typeof vi.fn<() => void>>
  onNext: ReturnType<typeof vi.fn<() => void>>
  onPrev: ReturnType<typeof vi.fn<() => void>>
  onSeekBy: ReturnType<typeof vi.fn<(delta: number) => void>>
  onVolumeBy: ReturnType<typeof vi.fn<(delta: number) => void>>
  onVolumeUp: ReturnType<typeof vi.fn<() => void>>
  onVolumeDown: ReturnType<typeof vi.fn<() => void>>
}

function makeCallbacks(): Callbacks {
  return {
    onToggle: vi.fn<() => void>(),
    onToggleMute: vi.fn<() => void>(),
    onNext: vi.fn<() => void>(),
    onPrev: vi.fn<() => void>(),
    onSeekBy: vi.fn<(delta: number) => void>(),
    onVolumeBy: vi.fn<(delta: number) => void>(),
    onVolumeUp: vi.fn<() => void>(),
    onVolumeDown: vi.fn<() => void>(),
  }
}

/** Эмулирует keydown на window */
function pressKey(code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  window.dispatchEvent(event)
  return event
}

describe('useKeyboardShortcuts', () => {
  let unmountFns: Array<() => void> = []

  beforeEach(() => {
    unmountFns = []
  })

  afterEach(() => {
    unmountFns.forEach((fn) => fn())
    unmountFns = []
  })

  // --- Хелпер: сетап с автоматическим unmount в afterEach --------------

  function setupTracked() {
    const callbacks = makeCallbacks()
    const { unmount } = withSetup(() => useKeyboardShortcuts(callbacks))
    unmountFns.push(unmount)
    return callbacks
  }

  // --- Space ----------------------------------------------------------

  describe('Space', () => {
    it('вызывает onToggle и preventDefault', () => {
      const cb = setupTracked()
      const event = pressKey('Space')
      expect(cb.onToggle).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)
    })
  })

  // --- Стрелки: seek --------------------------------------------------

  describe('ArrowLeft / ArrowRight', () => {
    it('ArrowRight → onSeekBy(+5)', () => {
      const cb = setupTracked()
      pressKey('ArrowRight')
      expect(cb.onSeekBy).toHaveBeenCalledWith(5)
    })

    it('ArrowLeft → onSeekBy(-5)', () => {
      const cb = setupTracked()
      pressKey('ArrowLeft')
      expect(cb.onSeekBy).toHaveBeenCalledWith(-5)
    })

    it('Shift + ArrowRight → onSeekBy(+30)', () => {
      const cb = setupTracked()
      pressKey('ArrowRight', { shiftKey: true })
      expect(cb.onSeekBy).toHaveBeenCalledWith(30)
    })

    it('Shift + ArrowLeft → onSeekBy(-30)', () => {
      const cb = setupTracked()
      pressKey('ArrowLeft', { shiftKey: true })
      expect(cb.onSeekBy).toHaveBeenCalledWith(-30)
    })
  })

  // --- Стрелки: volume ------------------------------------------------

  describe('ArrowUp / ArrowDown', () => {
    it('ArrowUp → onVolumeBy(+0.05)', () => {
      const cb = setupTracked()
      pressKey('ArrowUp')
      expect(cb.onVolumeBy).toHaveBeenCalledWith(0.05)
    })

    it('ArrowDown → onVolumeBy(-0.05)', () => {
      const cb = setupTracked()
      pressKey('ArrowDown')
      expect(cb.onVolumeBy).toHaveBeenCalledWith(-0.05)
    })
  })

  // --- N / P / M ------------------------------------------------------

  describe('N / P / M', () => {
    it('KeyN → onNext', () => {
      const cb = setupTracked()
      pressKey('KeyN')
      expect(cb.onNext).toHaveBeenCalledTimes(1)
    })

    it('KeyP → onPrev', () => {
      const cb = setupTracked()
      pressKey('KeyP')
      expect(cb.onPrev).toHaveBeenCalledTimes(1)
    })

    it('KeyM → onToggleMute', () => {
      const cb = setupTracked()
      pressKey('KeyM')
      expect(cb.onToggleMute).toHaveBeenCalledTimes(1)
    })
  })

  // --- Игнор модификаторов --------------------------------------------

  describe('игнорирует модификаторы', () => {
    it('Ctrl + Space не вызывает onToggle', () => {
      const cb = setupTracked()
      pressKey('Space', { ctrlKey: true })
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Meta + Space не вызывает onToggle', () => {
      const cb = setupTracked()
      pressKey('Space', { metaKey: true })
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Alt + N не вызывает onNext', () => {
      const cb = setupTracked()
      pressKey('KeyN', { altKey: true })
      expect(cb.onNext).not.toHaveBeenCalled()
    })

    it('Shift НЕ игнорируется (используется для длинного seek)', () => {
      const cb = setupTracked()
      pressKey('ArrowRight', { shiftKey: true })
      expect(cb.onSeekBy).toHaveBeenCalled()
    })
  })

  // --- Игнор полей ввода ----------------------------------------------

  describe('игнорирует события в полях ввода', () => {
    let input: HTMLInputElement
    let textarea: HTMLTextAreaElement
    let select: HTMLSelectElement
    let editable: HTMLDivElement

    beforeEach(() => {
      input = document.createElement('input')
      textarea = document.createElement('textarea')
      select = document.createElement('select')
      editable = document.createElement('div')
      editable.contentEditable = 'true'

      document.body.appendChild(input)
      document.body.appendChild(textarea)
      document.body.appendChild(select)
      document.body.appendChild(editable)
    })

    afterEach(() => {
      input.remove()
      textarea.remove()
      select.remove()
      editable.remove()
    })

    function pressOn(target: HTMLElement, code: string) {
      const event = new KeyboardEvent('keydown', {
        code,
        bubbles: true,
        cancelable: true,
      })
      target.dispatchEvent(event)
      // Событие всплывает до window, где слушает handler
      return event
    }

    it('Space в input не вызывает onToggle', () => {
      const cb = setupTracked()
      pressOn(input, 'Space')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Space в textarea не вызывает onToggle', () => {
      const cb = setupTracked()
      pressOn(textarea, 'Space')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Space в select не вызывает onToggle', () => {
      const cb = setupTracked()
      pressOn(select, 'Space')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Space в contentEditable не вызывает onToggle', () => {
      const cb = setupTracked()
      // jsdom не реализует isContentEditable, подменяем свойство вручную
      Object.defineProperty(editable, 'isContentEditable', {
        value: true,
        configurable: true,
      })
      pressOn(editable, 'Space')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('N в input не вызывает onNext', () => {
      const cb = setupTracked()
      pressOn(input, 'KeyN')
      expect(cb.onNext).not.toHaveBeenCalled()
    })

    it('стрелки в input не вызывают onSeekBy', () => {
      const cb = setupTracked()
      pressOn(input, 'ArrowRight')
      pressOn(input, 'ArrowLeft')
      expect(cb.onSeekBy).not.toHaveBeenCalled()
    })
  })

  // --- Игнор незнакомых клавиш ----------------------------------------

  describe('незнакомые клавиши', () => {
    it('KeyZ ничего не вызывает', () => {
      const cb = setupTracked()
      pressKey('KeyZ')
      expect(cb.onToggle).not.toHaveBeenCalled()
      expect(cb.onNext).not.toHaveBeenCalled()
      expect(cb.onPrev).not.toHaveBeenCalled()
      expect(cb.onSeekBy).not.toHaveBeenCalled()
      expect(cb.onVolumeBy).not.toHaveBeenCalled()
      expect(cb.onToggleMute).not.toHaveBeenCalled()
    })

    it('Escape ничего не вызывает', () => {
      const cb = setupTracked()
      pressKey('Escape')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })

    it('Enter ничего не вызывает', () => {
      const cb = setupTracked()
      pressKey('Enter')
      expect(cb.onToggle).not.toHaveBeenCalled()
    })
  })

  // --- Unmount --------------------------------------------------------

  describe('unmount', () => {
    it('после unmount хоткеи не срабатывают', () => {
      const cb = makeCallbacks()
      const { unmount } = withSetup(() => useKeyboardShortcuts(cb))

      pressKey('Space')
      expect(cb.onToggle).toHaveBeenCalledTimes(1)

      unmount()

      pressKey('Space')
      expect(cb.onToggle).toHaveBeenCalledTimes(1) // не увеличилось
    })
  })

  // --- Неиспользуемые колбэки -----------------------------------------

  describe('onVolumeUp / onVolumeDown', () => {
    it('не вызываются из composable (мёртвые параметры интерфейса)', () => {
      const cb = setupTracked()
      pressKey('ArrowUp')
      pressKey('ArrowDown')
      expect(cb.onVolumeUp).not.toHaveBeenCalled()
      expect(cb.onVolumeDown).not.toHaveBeenCalled()
      // Но onVolumeBy вызывается
      expect(cb.onVolumeBy).toHaveBeenCalledTimes(2)
    })
  })

  // --- ВНИМАНИЕ: этот тест фиксирует ТЕКУЩИЙ баг ---
  // Space на сфокусированной кнопке вызывает onToggle (наш хендлер),
  // и одновременно браузер сгенерирует click на кнопке при реальном
  // нажатии (в jsdom этого не происходит, но в браузере — да).
  // После фикса (игнор BUTTON в isEditableTarget) — тест станет красным.
  describe('[БАГ] Space на кнопке в фокусе', () => {
    let button: HTMLButtonElement

    beforeEach(() => {
      button = document.createElement('button')
      button.textContent = 'Play'
      document.body.appendChild(button)
      button.focus()
    })

    afterEach(() => {
      button.remove()
    })

    it('[БАГ] Space на сфокусированной кнопке вызывает onToggle', () => {
      const cb = setupTracked()
      pressKey('Space')
      // Сейчас: вызывается. После фикса: не должно.
      expect(cb.onToggle).toHaveBeenCalledTimes(1)
    })
  })
})
