<!-- src/components/molecules/BottomSheet.vue -->
<script setup lang="ts">
import IconButton from '../atoms/IconButton.vue';

defineProps<{
  isOpen: boolean;
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[150] flex flex-col justify-end bg-bg/60 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <Transition
          appear
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div class="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-bg-elevated shadow-2xl">
            <!-- Шапка -->
            <div class="flex shrink-0 items-center justify-between border-b border-hover-bg px-4 py-3">
              <h2 class="text-lg font-medium text-fg">{{ title }}</h2>
              <IconButton icon="x" variant="ghost" label="Закрыть" @click="emit('close')" />
            </div>

            <!-- Контент -->
            <div class="flex-1 overflow-y-auto p-4 pb-8">
              <slot />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
