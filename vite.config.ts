// vite.config.ts

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import vueJsx from '@vitejs/plugin-vue-jsx';

import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

import pkg from './package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const appVersion = pkg.version;
const buildHash = process.env.GIT_HASH ?? 'dev';
const shortHash = buildHash.slice(0, 7);

function injectVersion() {
  return {
    name: 'inject-version',
    transformIndexHtml(html: string) {
      return html.replaceAll('%APP_VERSION%', appVersion).replaceAll('%BUILD_HASH%', shortHash);
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(process.env.GIT_HASH ?? 'dev'),
    'process.env': {},
  },
  plugins: [
    vue(),
    vueJsx(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'CUEI Media Player',
        short_name: 'cuei',
        description: 'Офлайн PWA-плеер для локальной музыкальной библиотеки',
        theme_color: '#091227',
        background_color: '#091227',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'ru',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
    injectVersion(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  // Vite проксирует /api/* на localhost:3000 (иначе cookie не будут работать в dev-режиме)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
});
