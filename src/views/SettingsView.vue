<!-- src/views/SettingsView.vue -->

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SettingsGeneral from './settings/SettingsGeneral.vue';
import SettingsPlugins from './settings/SettingsPlugins.vue';
import SettingsData from './settings/SettingsData.vue';
import SettingsAbout from './settings/SettingsAbout.vue';

type Tab = 'general' | 'plugins' | 'data' | 'about';

const route = useRoute();
const router = useRouter();

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'general', label: 'Общие' },
  { id: 'plugins', label: 'Плагины' },
  { id: 'data', label: 'Данные' },
  { id: 'about', label: 'О приложении' },
];

// Читаем таб из хэша при загрузке
const getInitialTab = (): Tab => {
  const hash = route.hash.replace('#', '');
  if (TABS.some((t) => t.id === hash)) return hash as Tab;
  return 'general';
};

const activeTab = ref<Tab>(getInitialTab());

// При смене таба обновляем хэш в URL
watch(activeTab, (tab) => {
  router.replace({ hash: `#${tab}` });
});

// Если пользователь нажал "назад" и хэш изменился — переключаем таб
watch(
  () => route.hash,
  (hash) => {
    const tab = hash.replace('#', '');
    if (TABS.some((t) => t.id === tab) && tab !== activeTab.value) {
      activeTab.value = tab as Tab;
    }
  },
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка с табами -->
    <div class="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-2 border-b border-hover-bg">
      <div class="mx-auto flex w-full max-w-2xl items-center">
        <h1 class="text-lg font-medium text-fg">Настройки</h1>
      </div>

      <div class="mx-auto flex w-full max-w-2xl gap-1 overflow-x-auto pb-1">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="rounded-btn px-3 py-1.5 text-sm font-medium transition"
          :class="activeTab === tab.id ? 'bg-card-bg text-fg' : 'text-fg-muted hover:text-fg'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-4 pb-10">
        <SettingsGeneral v-if="activeTab === 'general'" />
        <SettingsPlugins v-else-if="activeTab === 'plugins'" />
        <SettingsData v-else-if="activeTab === 'data'" />
        <SettingsAbout v-else-if="activeTab === 'about'" />
      </div>
    </div>
  </div>
</template>
