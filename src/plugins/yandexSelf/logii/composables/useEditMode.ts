// src/plugins/yandexSelf/logii/composables/useEditMode.ts

import { ref, watch, type Ref } from 'vue';

const EDIT_MODE_KEY = 'logii:editMode';

export function useEditMode(): { isEditMode: Ref<boolean> } {
  const stored = localStorage.getItem(EDIT_MODE_KEY);
  const isEditMode = ref(stored === 'true');

  watch(isEditMode, (value) => {
    localStorage.setItem(EDIT_MODE_KEY, String(value));
  });

  return { isEditMode };
}
