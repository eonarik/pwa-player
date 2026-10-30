<!-- src/components/ui/ToastHost.vue -->

<script setup lang="ts">
import { toastService } from '@/services/ui/ToastService';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { Toast, ToastType } from '@/services/ui/ToastService';

const toasts = toastService.toasts;

function dismiss(id: string) {
  toastService.dismiss(id);
}

function runAction(toast: Toast) {
  toast.action?.onAction();
  dismiss(toast.id);
}

function iconFor(type: ToastType): string {
  if (type === 'success') return 'check';
  if (type === 'error') return 'x';
  return 'info';
}

function classesFor(type: ToastType): string {
  if (type === 'success') return 'bg-bg-elevated text-active';
  if (type === 'error') return 'bg-bg-elevated text-red-400';
  return 'bg-bg-elevated text-fg';
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-24 left-1/2 z-[200] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-2 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 rounded-card px-4 py-3 shadow-lg"
          :class="classesFor(toast.type)"
          role="status"
        >
          <Icon :name="iconFor(toast.type)" w="w-5" h="h-5" class="shrink-0" />

          <p class="min-w-0 flex-1 text-sm">{{ toast.message }}</p>

          <button
            v-if="toast.action"
            type="button"
            class="shrink-0 rounded-btn bg-hover-bg px-3 py-1 text-xs font-medium transition hover:bg-active-bg"
            @click="runAction(toast)"
          >
            {{ toast.action.label }}
          </button>

          <IconButton v-else icon="x" variant="ghost" size="sm" label="Закрыть" @click="dismiss(toast.id)" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
