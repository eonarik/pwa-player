<!-- src/components/ui/ModalLayout.vue -->

<script setup lang="ts">
import IconButton from './IconButton.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    maxWidth?: 'sm' | 'md' | 'lg';
    disableBackdropClose?: boolean;
    fullscreen?: boolean;
  }>(),
  {
    maxWidth: 'md',
    disableBackdropClose: false,
    fullscreen: false,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget && !props.disableBackdropClose) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[150] flex items-center justify-center bg-bg/70"
      :class="fullscreen ? 'p-0' : 'px-4 py-6'"
      @click="onBackdrop"
    >
      <div
        class="flex w-full flex-col bg-bg-elevated shadow-xl"
        :class="[
          fullscreen ? 'h-full max-w-none rounded-none' : 'max-h-[85vh] rounded-card',
          !fullscreen && maxWidth === 'sm' ? 'max-w-sm' : '',
          !fullscreen && maxWidth === 'md' ? 'max-w-md' : '',
          !fullscreen && maxWidth === 'lg' ? 'max-w-2xl' : '',
        ]"
      >
        <!-- Шапка -->
        <div class="flex shrink-0 items-center justify-between gap-4 px-5 py-4 border-b border-hover-bg">
          <h2 class="text-lg font-medium text-fg truncate">{{ title }}</h2>

          <div class="flex shrink-0 items-center gap-1">
            <slot name="header-actions" />
            <IconButton icon="x" variant="ghost" label="Закрыть" @click="emit('close')" />
          </div>
        </div>

        <!-- Контент -->
        <div class="flex-1 overflow-y-auto p-5" :class="fullscreen ? '!p-0' : ''">
          <slot />
        </div>

        <!-- Футер (опционально) -->
        <div v-if="$slots.footer" class="shrink-0 px-5 py-4 border-t border-hover-bg">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
