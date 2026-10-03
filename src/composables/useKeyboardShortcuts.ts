// src/composables/useKeyboardShortcuts.ts

import { onMounted, onUnmounted } from 'vue'
import { modalService } from '@/services/ui/ModalService'

interface KeyboardOptions {
  onToggle: () => void
  onToggleMute: () => void
  onNext: () => void
  onPrev: () => void
  onSeekBy: (delta: number) => void
  onVolumeBy: (delta: number) => void
}

/**
 * Глобальные горячие клавиши плеера.
 * Игнорирует события внутри input/textarea/contenteditable,
 * при открытой модалке (ModalService),
 * а также Space на сфокусированных кнопках/ссылках — иначе
 * сработает и наш хендлер, и браузерный click.
 */
export function useKeyboardShortcuts(options: KeyboardOptions) {
  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (target.isContentEditable) return true
    // jsdom не реализует isContentEditable, поэтому проверяем атрибут
    return target.closest('[contenteditable="true"], [contenteditable=""]') !== null
  }

  /**
   * Space на кнопке/ссылке вызывает браузерный click.
   * Если мы тоже обработаем Space — будет двойное срабатывание.
   */
  function isButtonLikeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'BUTTON' || tag === 'A') return true
    // role=button ведёт себя как кнопка — Space вызывает click
    return target.closest('[role="button"]') !== null
  }

  function handler(e: KeyboardEvent) {
    // Модалка открыта — не перехватываем хоткеи
    if (modalService.active.value !== null) return

    if (isEditableTarget(e.target)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    // Space на кнопке — отдаём браузеру, он сделает click
    if (e.code === 'Space' && isButtonLikeTarget(e.target)) return

    switch (e.code) {
      case 'Space':
        e.preventDefault()
        options.onToggle()
        break

      case 'ArrowRight':
        e.preventDefault()
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
        options.onToggleMute()
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
