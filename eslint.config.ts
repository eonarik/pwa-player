// eslint.config.ts

import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
import pluginOxlint from 'eslint-plugin-oxlint';
import skipFormatting from 'eslint-config-prettier/flat';

export default defineConfigWithVueTs(
  // 1. Общие настройки для всех файлов, которые мы хотим чекать
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx,js,mjs}'],
  },

  // 2. Игнорируем то, что не относится к коду приложения
  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/.storybook/**', // Storybook
    'vite.config.ts', // Конфиг Vite
    'vitest.config.ts', // Конфиг Vitest
    'vitest.setup.ts', // Сетап Vitest
    'playwright.config.ts', // Конфиг Playwright
    'eslint.config.ts', // Сам конфиг ESLint
    'server/**', // Сервер (Node.js)
  ]),

  // 3. Настройки для фронтенда (Vue + TS)
  {
    name: 'app/frontend',
    files: ['src/**/*.{vue,ts,mts,tsx}'],
    extends: [...pluginVue.configs['flat/essential'], vueTsConfigs.recommended],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },

  // 4. Настройки для тестов
  {
    name: 'app/tests',
    files: ['src/**/*.spec.ts', 'src/**/__tests__/*', 'e2e/**/*.ts'],
    extends: [vueTsConfigs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // 5. Правила Vitest
  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*', 'src/**/*.spec.ts'],
  },

  // 6. Отключаем правила, которые уже проверил Oxlint
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  // 7. Отключаем правила форматирования (Prettier этим занимается)
  skipFormatting,
);
