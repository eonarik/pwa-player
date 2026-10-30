<!-- src/components/layout/AppDrawer.vue -->

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { usePlayerStore } from '@/stores/player';
import { MENU_ITEMS } from '@/navigation/menu';
import Icon from '@/components/ui/Icon.vue';
import IconButton from '@/components/ui/IconButton.vue';
import type { MenuItem } from '@/navigation/menu';
import { getExtensionMenuItems } from '@/plugins/extensions';
import { computed } from 'vue';

defineProps<{ open: boolean }>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-feedback'): void;
}>();

function onModalItem(item: MenuItem): void {
  emit('close');
  if (item.modal === 'feedback') emit('open-feedback');
}

const player = usePlayerStore();
const { queue } = storeToRefs(player);

const allMenuItems = computed<MenuItem[]>(() => {
  const extItems = getExtensionMenuItems().map((item) => ({
    route: item.routeName,
    label: item.label,
    icon: item.icon,
  }));

  const settingsIndex = MENU_ITEMS.findIndex((item) => item.route === 'settings');

  if (settingsIndex === -1) {
    return [...MENU_ITEMS, ...extItems];
  }

  return [...MENU_ITEMS.slice(0, settingsIndex), ...extItems, ...MENU_ITEMS.slice(settingsIndex)];
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-[120] bg-bg/90" @click="emit('close')" />
    </Transition>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="open"
        class="app-drawer-panel fixed inset-y-0 left-0 z-[130] flex w-[80vw] max-w-sm flex-col bg-bg shadow-[0_0_10px_rgba(0,0,0,0.25)]"
      >
        <div class="app-safe-top flex shrink-0 items-center gap-2 px-4 py-4">
          <IconButton icon="x" variant="ghost" size="md" label="Закрыть меню" @click="emit('close')" />
        </div>

        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-2 pb-[env(safe-area-inset-bottom)]">
          <template v-for="item in allMenuItems" :key="item.route || item.label">
            <RouterLink
              v-if="item.route"
              :to="{ name: item.route }"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="emit('close')"
            >
              <Icon :name="item.icon" w="w-6" h="h-6" class="shrink-0 text-fg-muted" />
              <span class="flex-1">{{ item.label }}</span>
              <span
                v-if="item.queueBadge && queue.length > 0"
                class="rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active"
              >
                {{ queue.length }}
              </span>
            </RouterLink>

            <button
              v-else-if="item.modal"
              type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="onModalItem(item)"
            >
              <Icon :name="item.icon" w="w-6" h="h-6" class="shrink-0 text-fg-muted" />
              <span class="flex-1">{{ item.label }}</span>
            </button>
          </template>
        </nav>
      </div>
    </Transition>
  </Teleport>
</template>
