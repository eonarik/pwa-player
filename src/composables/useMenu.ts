// src/composables/useMenu.ts

import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/**
 * Состояние выпадающего меню: открыто/закрыто + закрытие по клику снаружи.
 * Компонент вешает `ref="rootRef"` на корневой элемент меню (обёртка кнопки + dropdown).
 */
export function useMenu(): {
  isOpen: Ref<boolean>
  rootRef: Ref<HTMLElement | null>
  toggle: () => void
  close: () => void
} {
  const isOpen = ref(false)
  const rootRef = ref<HTMLElement | null>(null)

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function close() {
    isOpen.value = false
  }

  function onDocClick(e: MouseEvent) {
    if (!isOpen.value) return
    const target = e.target as Node
    if (rootRef.value && !rootRef.value.contains(target)) {
      close()
    }
  }

  onMounted(() => document.addEventListener('click', onDocClick))
  onUnmounted(() => document.removeEventListener('click', onDocClick))

  return { isOpen, rootRef, toggle, close }
}
