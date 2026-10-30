<!-- src/views/home/PluginCard.vue -->

<script setup lang="ts">
import Icon from '@/components/ui/Icon.vue';
import type { DisplayPlugin, SessionStatus } from '@/composables/usePluginsList';
import { computed } from 'vue';

const props = defineProps<{
  plugin: DisplayPlugin;
  isOffline: boolean;
  isOpening: boolean;
  isChecking: boolean;
  sessionStatus: SessionStatus | undefined;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  (e: 'open'): void;
  (e: 'open-local'): void;
  (e: 'connect'): void;
  (e: 'disconnect'): void;
}>();

const statusText = computed(() => {
  if (!props.plugin.available) return 'Недоступно в этом браузере';
  if (props.isOffline) return 'Офлайн';
  if (props.isOpening) return 'Открытие…';
  if (props.isChecking) return 'Проверка доступности…';
  if (props.sessionStatus === 'expired') return 'Сессия истекла';
  if (props.sessionStatus === 'unavailable') return 'Сервер недоступен';
  if (props.plugin.isStateless) return 'Доступно';
  if (!props.plugin.isDisconnected) return 'Подключено';
  if (props.plugin.hasLocalFiles) return 'Отключено (есть локальные файлы)';
  return 'Отключено';
});
</script>

<template>
  <div
    :data-plugin-id="plugin.manifest.id"
    class="flex items-center gap-4 rounded-card bg-card-bg p-4 transition hover:bg-hover-bg"
  >
    <div
      class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-hover-bg text-2xl"
    >
      <img
        v-if="plugin.manifest.icon.startsWith('/') || plugin.manifest.icon.startsWith('http')"
        :src="plugin.manifest.icon"
        :alt="plugin.manifest.name"
        class="h-full w-full object-cover"
      />
      <span v-else>{{ plugin.manifest.icon }}</span>

      <div v-if="isOpening" class="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
        <Icon name="spinner" w="w-5" h="h-5" class="animate-spin text-fg" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg">
        {{ plugin.manifest.name }}
      </p>
      <p class="truncate text-xs text-fg-muted">
        {{ statusText }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <template v-if="plugin.isStateless">
        <button
          type="button"
          class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isChecking || isOpening"
          @click="emit('open')"
        >
          Открыть
        </button>
        <button
          v-if="plugin.hasCustomData"
          type="button"
          class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isChecking"
          @click="emit('disconnect')"
        >
          Очистить
        </button>
      </template>

      <template v-else-if="!plugin.isDisconnected">
        <button
          type="button"
          class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isChecking || isOpening"
          @click="emit('open')"
        >
          Открыть
        </button>
        <button
          type="button"
          class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isBusy || isChecking"
          @click="emit('disconnect')"
        >
          Отключить
        </button>
      </template>

      <template v-else-if="plugin.spaceAvailable && plugin.hasLocalFiles">
        <button
          type="button"
          class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isChecking || isOpening"
          @click="emit('open-local')"
        >
          Открыть локально
        </button>
        <button
          type="button"
          class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isBusy || isChecking"
          @click="emit('connect')"
        >
          {{ isBusy ? 'Подключение…' : 'Подключить' }}
        </button>
      </template>

      <button
        v-else
        type="button"
        class="rounded-btn bg-card-bg px-4 py-2 text-sm text-fg transition hover:bg-hover-bg disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!plugin.available || isBusy || isChecking"
        @click="emit('connect')"
      >
        {{ isBusy ? 'Подключение…' : 'Подключить' }}
      </button>
    </div>
  </div>
</template>
