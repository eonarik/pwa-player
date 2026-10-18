// src/directives/tooltip.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createApp, h, reactive, type Directive } from 'vue'

interface TooltipState {
  text: string
  visible: boolean
  top: number
  left: number
  activeEl: HTMLElement | null // ← Добавили: кто сейчас владеет тултипом
}

const state = reactive<TooltipState>({
  text: '',
  visible: false,
  top: 0,
  left: 0,
  activeEl: null,
})

let tooltipAppMounted = false

export function initTooltip() {
  if (tooltipAppMounted) return
  tooltipAppMounted = true

  const host = document.createElement('div')
  document.body.appendChild(host)

  createApp({
    render() {
      if (!state.visible) return null
      return h(
        'div',
        {
          class: 'cuei-tooltip',
          style: {
            top: `${state.top}px`,
            left: `${state.left}px`,
          },
        },
        state.text,
      )
    },
  }).mount(host)
}

export const tooltip: Directive<HTMLElement, string | null | undefined> = {
  mounted(el, binding) {
    ;(el as any)._tooltipText = binding.value

    const position = () => {
      requestAnimationFrame(() => {
        if (state.activeEl !== el) return // Проверяем, что позиционируем именно свой элемент

        const rect = el.getBoundingClientRect()
        const tipEl = document.querySelector('.cuei-tooltip') as HTMLElement | null
        if (!tipEl) return

        const tipRect = tipEl.getBoundingClientRect()
        const margin = 8

        let top = rect.top - tipRect.height - margin
        let left = rect.left + rect.width / 2 - tipRect.width / 2

        if (top < margin) top = rect.bottom + margin
        if (left < margin) left = margin
        if (left + tipRect.width > window.innerWidth - margin) {
          left = window.innerWidth - tipRect.width - margin
        }

        state.top = top
        state.left = left
      })
    }

    const show = () => {
      const text = (el as any)._tooltipText
      if (!text) return

      state.activeEl = el // ← Запоминаем, что тултип принадлежит этому элементу
      state.text = text
      state.visible = true
      position()
    }

    const hide = () => {
      if (state.activeEl === el) {
        state.visible = false
        state.activeEl = null
      }
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    el.addEventListener('focusin', show)
    el.addEventListener('focusout', hide)

    ;(el as any)._tooltipShow = show
    ;(el as any)._tooltipHide = hide
    ;(el as any)._tooltipPosition = position
  },

  updated(el, binding) {
    ;(el as any)._tooltipText = binding.value

    // Обновляем тултип, только если он принадлежит ЭТОМУ элементу
    if (state.visible && state.activeEl === el) {
      state.text = binding.value ?? ''
      if (binding.value) {
        ;(el as any)._tooltipPosition?.()
      } else {
        state.visible = false
        state.activeEl = null
      }
    }
  },

  unmounted(el) {
    el.removeEventListener('mouseenter', (el as any)._tooltipShow)
    el.removeEventListener('mouseleave', (el as any)._tooltipHide)
    el.removeEventListener('focusin', (el as any)._tooltipShow)
    el.removeEventListener('focusout', (el as any)._tooltipHide)

    if (state.activeEl === el) {
      state.visible = false
      state.activeEl = null
    }

    delete (el as any)._tooltipShow
    delete (el as any)._tooltipHide
    delete (el as any)._tooltipText
    delete (el as any)._tooltipPosition
  },
}
