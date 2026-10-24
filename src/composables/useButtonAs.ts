// src/composables/useButtonAs.ts

import { computed, type ComputedRef } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export interface ButtonAsProps {
  as?: 'button' | 'a'
  href?: string
  to?: RouteLocationRaw
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export interface UseButtonAsReturn {
  /** Компонент или тег для рендера. */
  tag: ComputedRef<string | typeof RouterLink>
  /** Пропсы, которые нужно передать в `tag`. */
  tagProps: ComputedRef<Record<string, unknown>>
  /** Обработчик клика (стопорит всплытие, если это не ссылка/сабмит). */
  onClick: (e: MouseEvent) => void
  /** Является ли элемент ссылкой. */
  isLink: ComputedRef<boolean>
}

/**
 * Универсальная логика для компонентов, которые могут быть
 * кнопкой, ссылкой `<a>` или `RouterLink`.
 */
export function useButtonAs(props: ButtonAsProps): UseButtonAsReturn {
  const isLink = computed(() => Boolean(props.to || props.href))

  const tag = computed(() => {
    if (props.to) return RouterLink
    if (props.as === 'a' || props.href) return 'a'
    return 'button'
  })

  const tagProps = computed(() => {
    if (props.to) return { to: props.to }
    if (props.href) return { href: props.href }

    // Для обычной кнопки
    return {
      type: props.type ?? 'button',
      disabled: props.disabled,
    }
  })

  const onClick = (e: MouseEvent) => {
    // Если это ссылка или submit — не стопаем (иначе сломается навигация или отправка формы)
    const isSubmit = props.type === 'submit' && !isLink.value
    if (!isLink.value && !isSubmit) {
      e.stopPropagation()
    }
  }

  return { tag, tagProps, onClick, isLink }
}
