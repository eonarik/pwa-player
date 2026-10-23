// src/composables/useMenu.ts

import { onMounted, onUnmounted, ref, watch, type ComponentPublicInstance, type Ref } from 'vue'

interface MenuPosition {
  top: number
  left: number
}

interface UseMenuOptions {
  /** Ширина dropdown в px — для выравнивания по правому краю */
  width?: number
  /** Отступ от кнопки вниз, px */
  offset?: number
  /** Выравнивание: right — по правому краю кнопки, left — по левому */
  align?: 'right' | 'left'
}

interface UseMenuReturn {
  isOpen: Ref<boolean>
  triggerRef: Ref<HTMLElement | null>
  setTriggerRef: (el: Element | ComponentPublicInstance | null) => void
  position: Ref<MenuPosition>
  toggle: () => void
  open: () => void
  close: () => void
}

const EDGE_MARGIN = 8

// Глобальное состояние: id текущего открытого меню
const activeMenuId = ref<string | null>(null)

export function useMenu(options: UseMenuOptions = {}): UseMenuReturn {
  const { width = 256, offset = 4, align = 'right' } = options

  // Уникальный id для этого экземпляра меню
  const menuId = `menu-${Math.random().toString(36).slice(2, 9)}`

  const isOpen = ref(false)
  const triggerRef = ref<HTMLElement | null>(null)
  const position = ref<MenuPosition>({ top: 0, left: 0 })

  function setTriggerRef(el: Element | ComponentPublicInstance | null): void {
    triggerRef.value = el as HTMLElement | null
  }

  function computePosition(): void {
    const el = triggerRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()

    let left = align === 'right' ? rect.right - width : rect.left

    const maxLeft = window.innerWidth - width - EDGE_MARGIN
    left = Math.max(EDGE_MARGIN, Math.min(left, maxLeft))

    position.value = {
      top: rect.bottom + offset,
      left,
    }
  }

  function open(): void {
    activeMenuId.value = menuId
    computePosition()
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
    if (activeMenuId.value === menuId) {
      activeMenuId.value = null
    }
  }

  function toggle(): void {
    if (isOpen.value) close()
    else open()
  }

  // Следим за глобальным состоянием: если открыли другое меню — закрываем это
  watch(activeMenuId, (id) => {
    if (id !== menuId && isOpen.value) {
      isOpen.value = false
    }
  })

  function onDocClick(e: MouseEvent): void {
    if (!isOpen.value) return

    const target = e.target as Node
    if (triggerRef.value && triggerRef.value.contains(target)) return
    close()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen.value) {
      close()
    }
  }

  function onWindowChange(): void {
    if (isOpen.value) computePosition()
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', onWindowChange)
    window.removeEventListener('scroll', onWindowChange, true)
    if (activeMenuId.value === menuId) {
      activeMenuId.value = null
    }
  })

  return { isOpen, triggerRef, setTriggerRef, position, toggle, open, close }
}
