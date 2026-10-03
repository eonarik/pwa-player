// vitest.config.ts

import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**', 'server/node_modules/**'],
    projects: [
      {
        plugins: [vue(), vueJsx(), tailwindcss()],
        resolve: {
          alias: {
            '@': path.resolve(__dirname, './src'),
          },
        },
        define: {
          __APP_VERSION__: JSON.stringify('test'),
          __BUILD_HASH__: JSON.stringify('test'),
        },
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['src/**/*.spec.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/src/**/*.spec.js'],
        },
      },
    ],
  },
})
