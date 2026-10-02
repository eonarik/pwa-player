<!-- src/components/layout/AppDrawer.vue -->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { MENU_ITEMS } from '@/navigation/menu'
import IconX from '@/components/icons/IconX.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const player = usePlayerStore()
const { queue } = storeToRefs(player)
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100"
      leave-active-class="transition duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-[120] bg-bg/90" @click="emit('close')" />
    </Transition>

    <!-- Панель -->
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0" leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0" leave-to-class="-translate-x-full">
      <div v-if="open"
        class="fixed inset-y-0 left-0 z-[130] flex w-[80vw] max-w-sm flex-col bg-bg shadow-[0_0_10px_rgba(0,0,0,0.25)]">
        <div class="app-safe-top flex items-center gap-2 px-4 py-4">
          <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg" aria-label="Закрыть меню"
            @click="emit('close')">
            <IconX class="h-6 w-6" />
          </button>
        </div>

        <nav class="flex flex-1 flex-col gap-1 px-4 py-2">
          <RouterLink v-for="item in MENU_ITEMS" :key="item.route" :to="{ name: item.route }"
            class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
            @click="emit('close')">
            <component :is="item.icon" class="h-6 w-6 shrink-0 text-fg-muted" />
            <span class="flex-1">{{ item.label }}</span>
            <span v-if="item.queueBadge && queue.length > 0"
              class="rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active">
              {{ queue.length }}
            </span>
          </RouterLink>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>
