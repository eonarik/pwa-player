<!-- src/views/HomeView.vue -->

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePluginsList } from '@/composables/usePluginsList';
import { usePluginActions } from '@/composables/usePluginActions';
import PluginCard from './home/PluginCard.vue';
import type { PluginManifest } from '@/plugins/types';

const route = useRoute();
const router = useRouter();

const { plugins, isOffline, sessionStatus, isChecking, loadPlugins } = usePluginsList();

const { isLoading, isOpening, openPlugin, connectPlugin, disconnectPlugin } = usePluginActions({
  onReload: loadPlugins,
});

async function onOpen(row: { manifest: PluginManifest }) {
  await openPlugin(row, { localOnly: false });
}

async function onOpenLocal(row: { manifest: PluginManifest }) {
  await openPlugin(row, { localOnly: true });
}

function onConnect(row: { manifest: PluginManifest }) {
  void connectPlugin(row);
}

function onDisconnect(row: { manifest: PluginManifest }) {
  void disconnectPlugin(row);
}

onMounted(async () => {
  await loadPlugins();

  if (route.query.auth === 'ok') {
    await router.replace({ path: route.path });
    const yandexManifest = plugins.value.find((p) => p.manifest.id === 'yandex')?.manifest;
    if (yandexManifest) {
      localStorage.setItem('yandex-connected', 'true');
      localStorage.removeItem('yandex-disconnected');
      onConnect({ manifest: yandexManifest });
    }
  }
});
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <div class="mx-auto w-full max-w-2xl">
      <h1 class="mb-1 text-2xl font-medium text-fg">CUEI Media Player</h1>
      <p class="mb-6 text-sm text-fg-muted">Выберите источник музыки</p>

      <div v-if="plugins.length === 0" class="text-sm text-fg-muted">Плагины не найдены</div>

      <div v-else class="flex flex-col gap-2">
        <PluginCard
          v-for="row in plugins"
          :key="row.manifest.id"
          :plugin="row"
          :is-offline="isOffline"
          :is-opening="isOpening(row.manifest.id)"
          :is-checking="isChecking(row.manifest.id)"
          :session-status="sessionStatus(row.manifest.id)"
          :is-busy="isLoading === row.manifest.id"
          @open="onOpen(row)"
          @open-local="onOpenLocal(row)"
          @connect="onConnect(row)"
          @disconnect="onDisconnect(row)"
        />
      </div>
    </div>
  </div>
</template>
