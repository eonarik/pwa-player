// .storybook/preview.ts
import type { Preview } from '@storybook/vue3';
import { setup } from '@storybook/vue3';
import { createPinia } from 'pinia';

// Импорт стилей и директив проекта
import '../src/assets/main.css';
import { themeService } from '../src/services/ui/ThemeService';
import { tooltip } from '../src/directives/tooltip';

// Инициализация глобальных сервисов
themeService.load();

setup((app) => {
  app.use(createPinia());
  app.directive('tooltip', tooltip);
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#091227' },
        { name: 'light', value: '#f8fafc' },
      ],
    },
  },
  decorators: [
    (story, context) => {
      // Переключение темы через глобальный параметр `theme`
      const theme = context.globals.theme || 'default';
      document.documentElement.setAttribute('data-theme', theme);

      return {
        components: { story },
        template: '<div class="bg-bg min-h-screen text-fg p-4"><story /></div>',
      };
    },
  ],
  globalTypes: {
    theme: {
      description: 'Глобальная тема',
      defaultValue: 'default',
      toolbar: {
        title: 'Тема',
        icon: 'paintbrush',
        items: [
          { value: 'default', title: 'Тёмная' },
          { value: 'radio', title: 'Ретро-радио' },
          { value: 'neon', title: 'Киберпанк' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
