// src/components/library/metadata/useFloatingDropdown.ts

import { nextTick, onMounted, onUnmounted, ref, type CSSProperties, type Ref } from 'vue';

/** Стиль teleported-панели: совместим с :style, но с обязательными осями. */
export interface FloatingDropdownStyle extends CSSProperties {
  top: string;
  left: string;
  width: string;
}

export interface FloatingDropdown {
  isOpen: Ref<boolean>;
  triggerRef: Ref<HTMLElement | null>;
  dropdownRef: Ref<HTMLElement | null>;
  position: Ref<FloatingDropdownStyle>;
  toggle: () => void;
  close: () => void;
}

const EDGE_MARGIN = 8;
const GAP = 4;

/**
 * Позиционирование teleported-выпадашки под триггером: ширина по триггеру,
 * удержание в границах вьюпорта, пересчёт при scroll/resize, закрытие по
 * клику вне триггера и панели.
 */
export function useFloatingDropdown(): FloatingDropdown {
  const isOpen = ref(false);
  const triggerRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const position = ref<FloatingDropdownStyle>({ top: '0px', left: '0px', width: '0px' });

  function updatePosition(): void {
    const trigger = triggerRef.value;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = rect.width;
    let left = rect.left;
    const maxLeft = window.innerWidth - width - EDGE_MARGIN;
    if (left > maxLeft) left = Math.max(EDGE_MARGIN, maxLeft);

    position.value = {
      top: `${rect.bottom + GAP}px`,
      left: `${left}px`,
      width: `${width}px`,
    };
  }

  function addMoveListeners(): void {
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
  }

  function removeMoveListeners(): void {
    window.removeEventListener('scroll', updatePosition, true);
    window.removeEventListener('resize', updatePosition);
  }

  function toggle(): void {
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      removeMoveListeners();
      return;
    }
    void nextTick(updatePosition);
    addMoveListeners();
  }

  function close(): void {
    if (!isOpen.value) return;
    isOpen.value = false;
    removeMoveListeners();
  }

  function handleClickOutside(e: MouseEvent): void {
    const target = e.target as Node;
    if (triggerRef.value && triggerRef.value.contains(target)) return;
    if (dropdownRef.value && dropdownRef.value.contains(target)) return;
    close();
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    removeMoveListeners();
  });

  return { isOpen, triggerRef, dropdownRef, position, toggle, close };
}
