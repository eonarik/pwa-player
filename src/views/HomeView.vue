<!-- src/views/HomeView.vue -->

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePluginsList } from '@/composables/usePluginsList';
import { usePluginActions } from '@/composables/usePluginActions';
import { useLibraryStore } from '@/stores/library';
import PluginCard from './home/PluginCard.vue';
import MetadataCandidatesButton from '@/components/library/MetadataCandidatesButton.vue';
import type { PluginManifest } from '@/plugins/types';
import { logger } from '@/utils/logger';
import { toggleDiagnosticsPanel } from '@/utils/pluginDiagnostics';

const route = useRoute();
const router = useRouter();
const library = useLibraryStore();

/** Все треки библиотеки — для MetadataCandidatesButton, который сам решает по duplicateTrackIds. */
const allTracks = computed(() => Object.values(library.tracks));

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

/**
 * Кому принадлежит OAuth-возврат `/?auth=ok`.
 *
 * Ядро не знает провайдеров авторизации и ключи localStorage плагинов —
 * оно опрашивает их по очереди. Первый признавший callback своим — победитель.
 */
async function findAuthCallbackOwner(): Promise<PluginManifest | null> {
  for (const row of plugins.value) {
    try {
      if (await row.plugin.handleAuthCallback?.()) return row.manifest;
    } catch (err) {
      logger.warn(`[home] handleAuthCallback failed for "${row.manifest.id}"`, err);
    }
  }
  return null;
}

onMounted(async () => {
  await loadPlugins();

  if (route.query.auth !== 'ok') return;

  await router.replace({ path: route.path });

  const owner = await findAuthCallbackOwner();
  if (owner) onConnect({ manifest: owner });
});
</script>

<template>
  <div class="flex h-full flex-col overflow-y-auto p-6">
    <div class="mx-auto w-full max-w-2xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-2xl font-medium text-fg">CUEI Media Player</h1>
        <MetadataCandidatesButton :tracks="allTracks" />
      </div>
      <p class="mb-6 text-sm text-fg-muted">Выберите источник музыки</p>

      <div v-if="plugins.length === 0" class="flex flex-col gap-3 text-sm text-fg-muted">
        <div>Плагины не найдены</div>
        <button
          type="button"
          class="self-start rounded-btn border border-fg-muted/30 px-3 py-1.5 text-sm text-fg"
          @click="toggleDiagnosticsPanel"
        >
          Детали диагностики
        </button>
      </div>

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
