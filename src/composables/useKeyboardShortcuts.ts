// src/composables/useKeyboardShortcuts.ts

import { onMounted, onUnmounted } from 'vue'

interface KeyboardOptions {
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeekBy: (delta: number) => void
  onVolumeBy: (delta: number) => void
  onVolumeUp: () => void
  onVolumeDown: () => void
}

/**
 * Глобальные горячие клавиши плеера.
 * Игнорирует события внутри input/textarea/contenteditable.
 */
export function useKeyboardShortcuts(options: KeyboardOptions) {
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  }

  function handler(e: KeyboardEvent) {
    // Игнорируем, если фокус в поле ввода или нажат модификатор
    if (isEditableTarget(e.target)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    switch (e.code) {
      case 'Space':
        e.preventDefault()
        options.onToggle()
        break

      case 'ArrowRight':
        e.preventDefault()
        // Shift даёт «длинный» seek
        options.onSeekBy(e.shiftKey ? 30 : 5)
        break

      case 'ArrowLeft':
        e.preventDefault()
        options.onSeekBy(e.shiftKey ? -30 : -5)
        break

      case 'ArrowUp':
        e.preventDefault()
        options.onVolumeBy(0.05)
        break

      case 'ArrowDown':
        e.preventDefault()
        options.onVolumeBy(-0.05)
        break

      case 'KeyN':
        e.preventDefault()
        options.onNext()
        break

      case 'KeyP':
        e.preventDefault()
        options.onPrev()
        break

      case 'KeyM':
        e.preventDefault()
        // mute — отдельное действие, но здесь просто toggle через volumeBy
        // (см. ниже — лучше передать отдельный колбэк)
        break
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handler)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handler)
  })
}
