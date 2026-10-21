<!-- src/views/settings/SettingsPlugins.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPlugins, activatePlugin } from '@/plugins/registry'
import { toastService } from '@/services/ui/ToastService'
import PluginSettingsSection from '@/components/settings/PluginSettingsSection.vue'
import type { PluginManifest } from '@/plugins/types'
import type { PluginSettingsSchema } from '@/plugins/settingsTypes'

interface PluginSchema {
  manifest: PluginManifest
  schema: PluginSettingsSchema
}

const pluginSchemas = ref<PluginSchema[]>([])
const isPluginActionRunning = ref(false)

async function loadPluginSchemas(): Promise<void> {
  const result: PluginSchema[] = []
  for (const manifest of getPlugins()) {
    if (!manifest.getSettings) continue
    try {
      const schema = await manifest.getSettings()
      result.push({ manifest, schema })
    } catch (err) {
      console.warn(`[settings] failed to load settings for ${manifest.id}`, err)
    }
  }
  pluginSchemas.value = result
}

async function onPluginAction(
  manifest: PluginManifest,
  actionId: string,
  payload?: unknown,
): Promise<void> {
  if (!manifest.runSettingsAction) return
  if (isPluginActionRunning.value) return

  isPluginActionRunning.value = true
  try {
    await manifest.runSettingsAction(actionId, payload)
  } catch (err) {
    console.error('[settings] plugin action failed', err)
    toastService.error('Не удалось выполнить действие')
  } finally {
    isPluginActionRunning.value = false
    await loadPluginSchemas()
  }
}

function onPluginChange(manifest: PluginManifest, fieldId: string, value: unknown): void {
  console.log('[settings] plugin change', manifest.id, fieldId, value)
}

onMounted(() => {
  void loadPluginSchemas()
})

// --- Активация скрытых плагинов ---------------------------------------
const isSecretSectionOpen = ref(false)
const activationCode = ref('')

function handleActivation(): void {
  if (!activationCode.value.trim()) return

  const success = activatePlugin('yandex-self', activationCode.value)

  if (success) {
    toastService.success('Плагин активирован! Он появится на главной.')
    activationCode.value = ''
    setTimeout(() => window.location.reload(), 1000)
  } else {
    toastService.error('Неверный код активации')
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <section v-if="pluginSchemas.length > 0">
      <div class="flex flex-col gap-6">
        <div v-for="p in pluginSchemas" :key="p.manifest.id" class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="text-base">{{ p.manifest.icon }}</span>
            <span class="text-sm font-medium text-fg">{{ p.manifest.name }}</span>
          </div>
          <PluginSettingsSection v-for="section in p.schema.sections" :key="section.id" :section="section"
            :disabled="isPluginActionRunning" @action="(id, payload) => onPluginAction(p.manifest, id, payload)"
            @change="(id, value) => onPluginChange(p.manifest, id, value)" />
        </div>
      </div>
    </section>
    <section v-else class="text-sm text-fg-muted text-center py-10">
      Нет плагинов с настройками
    </section>

    <section>
      <h2
        class="mb-2 cursor-pointer text-xs font-medium uppercase tracking-wider text-fg-subtle select-none hover:text-fg-muted transition"
        @click="isSecretSectionOpen = !isSecretSectionOpen">
        Секретные функции
      </h2>
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
        <div v-if="isSecretSectionOpen" class="flex flex-col gap-2 bg-card-bg px-4 py-3">
          <p class="text-xs text-fg-muted">Введите код активации.</p>
          <div class="flex items-center gap-2">
            <input v-model="activationCode" type="text" placeholder="Код активации"
              class="flex-1 rounded-btn bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
              @keydown.enter="handleActivation" />
            <button type="button"
              class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover disabled:opacity-50"
              :disabled="!activationCode.trim()" @click="handleActivation">
              Активировать
            </button>
          </div>
        </div>
      </Transition>
    </section>
  </div>
</template>
