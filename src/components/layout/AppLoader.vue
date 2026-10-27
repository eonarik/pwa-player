<!-- src/components/layout/AppLoader.vue -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const PHRASES = [
  'Настраиваем плеер…',
  'Достаём пластинки…',
  'Секунду, распаковываем треки…',
  'Готовим сцену…',
  'Почти готово…',
  'Прогреваем лампы…',
  'Загружаем библиотеку…',
  'Крутим диски…',
]

const currentText = ref(PHRASES[Math.floor(Math.random() * PHRASES.length)]!)
const isFading = ref(false)

let ticker: ReturnType<typeof setInterval> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function pickNext(): string {
  let next = currentText.value
  while (next === currentText.value) {
    next = PHRASES[Math.floor(Math.random() * PHRASES.length)]!
  }
  return next
}

function startTicker(): void {
  ticker = setInterval(() => {
    isFading.value = true
    fadeTimer = setTimeout(() => {
      currentText.value = pickNext()
      isFading.value = false
    }, 300)
  }, 3000)
}

onMounted(startTicker)

onUnmounted(() => {
  if (ticker !== null) clearInterval(ticker)
  if (fadeTimer !== null) clearTimeout(fadeTimer)
})
</script>

<template>
  <div class="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-5 bg-bg p-6 text-center select-none">
    <div class="app-boot-loader__spinner" />
    <p class="min-h-[1.4em] text-sm text-fg-muted transition-opacity duration-300"
      :class="isFading ? 'opacity-0' : 'opacity-100'">
      {{ currentText }}
    </p>
  </div>
</template>
