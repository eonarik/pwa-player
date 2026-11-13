<!-- src/components/ui/AlphabetIndex.vue -->

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  letters: string[];
}>();

const emit = defineEmits<{
  (e: 'select', letter: string): void;
}>();

const isDragging = ref(false);
const activeLetter = ref('');
const bubbleY = ref(0); // Позиция каретки по Y (относительно окна)

function handleMove(e: PointerEvent) {
  if (!isDragging.value) return;

  const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (!target) return;

  const letter = target.dataset.letter;
  if (letter && letter !== activeLetter.value) {
    activeLetter.value = letter;
    emit('select', letter);

    // Позиционируем каретку на уровне пальца
    const rect = target.getBoundingClientRect();
    bubbleY.value = rect.top + rect.height / 2;
  }
}

function onPointerDown(e: PointerEvent) {
  isDragging.value = true;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  handleMove(e);
}

function onPointerUp(e: PointerEvent) {
  isDragging.value = false;
  (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  // Прячем каретку с небольшой задержкой
  setTimeout(() => {
    if (!isDragging.value) activeLetter.value = '';
  }, 300);
}
</script>

<template>
  <!-- Каретка (Bubble) -->
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-90"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-90"
  >
    <div
      v-if="activeLetter"
      class="fixed right-14 z-[60] flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-bg-elevated/90 text-3xl font-bold text-fg shadow-xl backdrop-blur ring-1 ring-white/10 pointer-events-none"
      :style="{ top: `${bubbleY}px` }"
    >
      {{ activeLetter }}
    </div>
  </Transition>

  <!-- Сам индекс -->
  <div
    class="fixed right-2 top-1/2 z-50 flex max-h-[80vh] -translate-y-1/2 touch-none flex-col items-center justify-start gap-0.5 overflow-y-auto rounded-full bg-bg-elevated/50 py-2 px-1 text-[10px] font-medium text-fg-muted shadow-lg backdrop-blur select-none scrollbar-hide"
    @pointerdown="onPointerDown"
    @pointermove="handleMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      v-for="letter in letters"
      :key="letter"
      :data-letter="letter"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-hover-bg"
      :class="activeLetter === letter ? 'bg-active text-bg font-bold' : ''"
    >
      {{ letter }}
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
