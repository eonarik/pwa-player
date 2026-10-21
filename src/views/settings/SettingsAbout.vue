<!-- src/views/settings/SettingsAbout.vue -->
<script setup lang="ts">
const appVersion = __APP_VERSION__
const buildHash = __BUILD_HASH__
const shortHash = buildHash.slice(0, 7)
</script>

<template>
  <div class="flex flex-col gap-6">
    <section>
      <div class="flex flex-col gap-2 bg-card-bg px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-fg">Версия</span>
          <span class="text-xs tabular-nums text-fg-muted">{{ appVersion }}</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-sm text-fg">Хэш билда</span>
          <span class="text-xs tabular-nums text-fg-muted">{{ shortHash }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
