<!-- src/plugins/radio/AddStationModal.vue -->

<script setup lang="ts">
import { ref } from 'vue';
import { toastService } from '@/services/ui/ToastService';
import ModalLayout from '@/components/ui/ModalLayout.vue';
import FormField from '@/components/ui/FormField.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';
import type { SavedStation } from './index';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add', station: SavedStation): void;
}>();

const url = ref('');
const name = ref('');
const isSubmitting = ref(false);

async function submit() {
  const cleanUrl = url.value.trim();
  if (!cleanUrl) return;

  let hostname = '';
  try {
    const parsed = new URL(cleanUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      toastService.error('Ссылка должна начинаться с http:// или https://');
      return;
    }
    hostname = parsed.hostname;
  } catch {
    toastService.error('Некорректный URL');
    return;
  }

  isSubmitting.value = true;
  try {
    const finalName = name.value.trim() || hostname || 'Неизвестная станция';
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

    emit('add', { id: cleanUrl, name: finalName, url: cleanUrl, favicon });
    emit('close');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <ModalLayout title="Добавить станцию" max-width="md" @close="emit('close')">
    <p class="mb-4 text-xs text-fg-muted">
      Введите прямую ссылку на поток (например, <span class="text-fg">https://stream.example.com/radio.m3u8</span>).
    </p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <FormField label="Ссылка на поток (URL) *">
        <Input v-model="url" type="url" placeholder="https://..." required />
      </FormField>

      <FormField label="Название станции" hint="Опционально, по умолчанию — домен">
        <Input v-model="name" type="text" placeholder="Моя любимая радиостанция" />
      </FormField>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" @click="emit('close')">Отмена</Button>
        <Button variant="primary" :disabled="!url.trim() || isSubmitting" @click="submit">
          {{ isSubmitting ? 'Добавление…' : 'Добавить' }}
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
