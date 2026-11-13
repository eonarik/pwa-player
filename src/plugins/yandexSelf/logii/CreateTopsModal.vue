<!-- src/plugins/yandexSelf/logii/CreateTopsModal.vue -->

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import ModalLayout from '@/components/molecules/ModalLayout.vue';
import FormField from '@/components/molecules/FormField.vue';
import Input from '@/components/atoms/Input.vue';
import InputWithAffix from '@/components/molecules/InputWithAffix.vue';
import Checkbox from '@/components/atoms/Checkbox.vue';
import Button from '@/components/atoms/Button.vue';
import Spinner from '@/components/atoms/Spinner.vue';
import { modalService } from '@/services/ui/ModalService';
import { logger } from '@/utils/logger';

export interface CreateTopsResult {
  count: number;
  introName: string | null;
}

const props = withDefaults(
  defineProps<{
    onSubmit: (result: CreateTopsResult) => Promise<boolean>;
    hasIntro?: boolean;
    defaultCount?: number;
    defaultIntroName?: string;
  }>(),
  {
    hasIntro: false,
    defaultCount: 20,
    defaultIntroName: 'intro',
  },
);

const countInput = ref(String(props.defaultCount));
const introName = ref(props.defaultIntroName);
const createIntro = ref(!props.hasIntro);
const isSubmitting = ref(false);
const error = ref<string | null>(null);
const countRef = ref<{ focus: () => void } | null>(null);

const parsedCount = computed(() => {
  const n = Number(countInput.value);
  if (!Number.isFinite(n)) return null;
  const int = Math.floor(n);
  if (int < 1 || int > 20) return null;
  return int;
});

const canSubmit = computed(() => {
  if (parsedCount.value === null) return false;
  if (createIntro.value && !introName.value.trim()) return false;
  return !isSubmitting.value;
});

async function submit(): Promise<void> {
  if (!canSubmit.value) return;

  const count = parsedCount.value!;
  const rawIntro = createIntro.value ? introName.value.trim() : '';

  if (createIntro.value && /[\\/:*?"<>|]/.test(rawIntro)) {
    error.value = 'Имя Intro не должно содержать \\ / : * ? " < > |';
    return;
  }

  // Суффикс .txt добавляется здесь; если пользователь ввёл ".txt" — обрезаем.
  const trimmedIntro = createIntro.value ? rawIntro.replace(/\.txt$/i, '') + '.txt' : null;

  isSubmitting.value = true;
  error.value = null;

  try {
    const ok = await props.onSubmit({ count, introName: trimmedIntro });
    if (ok) {
      modalService.confirm({ count, introName: trimmedIntro });
    } else {
      error.value = 'Не удалось создать топы';
      isSubmitting.value = false;
    }
  } catch (err) {
    logger.error('[create-tops] submit failed', err);
    error.value = err instanceof Error ? err.message : 'Не удалось создать топы';
    isSubmitting.value = false;
  }
}

function cancel(): void {
  if (isSubmitting.value) return;
  modalService.cancel();
}

onMounted(async () => {
  await nextTick();
  countRef.value?.focus();
});
</script>

<template>
  <ModalLayout title="Новые топы" max-width="sm" :disable-backdrop-close="isSubmitting" @close="cancel">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <FormField label="Количество папок (1..20)" :error="parsedCount === null ? 'Введите число' : undefined">
        <Input
          ref="countRef"
          v-model="countInput"
          type="number"
          placeholder="20"
          :disabled="isSubmitting"
          data-testid="create-tops-count"
        />
      </FormField>

      <div class="bg-card-bg px-3 py-2 rounded-btn">
        <Checkbox
          v-model="createIntro"
          label="Создать Intro"
          description="Пустой .txt-файл в корне автора"
          :disabled="isSubmitting"
        />
      </div>

      <FormField v-if="createIntro" label="Имя Intro">
        <InputWithAffix
          v-model="introName"
          placeholder="intro"
          suffix=".txt"
          :disabled="isSubmitting"
          test-id="create-tops-intro-name"
        />
      </FormField>

      <p v-if="error" class="text-xs text-red-400">{{ error }}</p>

      <p class="text-xs text-fg-muted">
        Будут созданы папки <span class="text-fg">1..{{ parsedCount ?? '?' }}</span>
        <template v-if="createIntro && introName.trim()">
          и <span class="text-fg">{{ introName.trim().replace(/\.txt$/i, '') }}.txt</span> </template
        >. Существующие папки будут пропущены.
      </p>
    </form>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button variant="ghost" :disabled="isSubmitting" @click="cancel">Отмена</Button>
        <Button variant="primary" :disabled="!canSubmit" data-testid="create-tops-submit" @click="submit">
          <Spinner v-if="isSubmitting" size="sm" />
          <span v-else>Создать</span>
        </Button>
      </div>
    </template>
  </ModalLayout>
</template>
