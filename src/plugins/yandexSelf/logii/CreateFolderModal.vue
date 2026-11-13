<!-- src/plugins/yandexSelf/logii/CreateFolderModal.vue -->

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import ModalLayout from '@/components/molecules/ModalLayout.vue';
import FormField from '@/components/molecules/FormField.vue';
import InputWithAffix from '@/components/molecules/InputWithAffix.vue';
import Button from '@/components/atoms/Button.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { modalService } from '@/services/ui/ModalService';
import { logger } from '@/utils/logger';

const props = withDefaults(
  defineProps<{
    title?: string;
    label?: string;
    placeholder?: string;
    namePrefix?: string;
    initialName?: string;
    validateName?: (name: string) => string | null;
    submitLabel?: string;
    onSubmit: (finalName: string) => Promise<string | null>;
  }>(),
  {
    title: 'Новая папка',
    label: 'Имя',
    placeholder: '',
    namePrefix: '',
    initialName: '',
    validateName: () => null,
    submitLabel: 'Создать',
  },
);

const name = ref(props.initialName);
const isSubmitting = ref(false);
const error = ref<string | null>(null);
const inputRef = ref<{ focus: () => void } | null>(null);

const finalName = computed(() => props.namePrefix + name.value.trim());
const canSubmit = computed(() => name.value.trim().length > 0 && !isSubmitting.value);

async function submit(): Promise<void> {
  if (!canSubmit.value) return;

  const trimmed = name.value.trim();
  const custom = props.validateName(trimmed);
  if (custom) {
    error.value = custom;
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    const result = await props.onSubmit(finalName.value);
    if (result) {
      modalService.confirm(result);
    } else {
      error.value = 'Не удалось создать';
      isSubmitting.value = false;
    }
  } catch (err) {
    logger.error('[create-folder] submit failed', err);
    error.value = err instanceof Error ? err.message : 'Не удалось создать';
    isSubmitting.value = false;
  }
}

function cancel(): void {
  if (isSubmitting.value) return;
  modalService.cancel();
}

onMounted(async () => {
  await nextTick();
  inputRef.value?.focus();
});
</script>

<template>
  <ModalLayout :title="title" max-width="sm" :disable-backdrop-close="isSubmitting" @close="cancel">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <FormField :label="label" :error="error ?? undefined">
        <InputWithAffix
          ref="inputRef"
          v-model="name"
          :prefix="namePrefix"
          :placeholder="placeholder"
          :disabled="isSubmitting"
          test-id="create-folder-input"
          @keydown.enter="submit"
        />
      </FormField>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" :disabled="isSubmitting" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="!canSubmit" data-testid="create-folder-submit" @click="submit">
          <Spinner v-if="isSubmitting" size="sm" />
          <span v-else>{{ submitLabel }}</span>
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
