<!-- src/components/ui/ToastHost.vue -->
<script setup lang="ts">
import { toastService } from '@/services/ui/ToastService'
import type { Toast, ToastType } from '@/services/ui/ToastService'

const toasts = toastService.toasts

function dismiss(id: string) {
  toastService.dismiss(id)
}

function runAction(toast: Toast) {
  toast.action?.onAction()
  dismiss(toast.id)
}

function iconFor(type: ToastType): string {
  if (type === 'success') return '✓'
  if (type === 'error') return '✕'
  return 'ℹ'
}

function classesFor(type: ToastType): string {
  if (type === 'success') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  if (type === 'error') return 'border-red-500/40 bg-red-500/10 text-red-300'
  return 'border-zinc-700 bg-zinc-800/90 text-zinc-200'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed bottom-24 left-1/2 z-[110] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      aria-live="polite" aria-atomic="true">
      <TransitionGroup enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100" leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100" leave-to-class="translate-y-2 opacity-0">
        <div v-for="toast in toasts" :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur"
          :class="classesFor(toast.type)" role="status">
          <span class="shrink-0 text-base leading-none">
            {{ iconFor(toast.type) }}
          </span>

          <p class="min-w-0 flex-1 text-sm">
            {{ toast.message }}
          </p>

          <button v-if="toast.action" type="button"
            class="shrink-0 rounded-md bg-current/10 px-3 py-1 text-xs font-medium transition hover:bg-current/20"
            @click="runAction(toast)">
            {{ toast.action.label }}
          </button>

          <button v-else type="button"
            class="shrink-0 rounded-md p-1 text-current opacity-60 transition hover:opacity-100" aria-label="Закрыть"
            @click="dismiss(toast.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
