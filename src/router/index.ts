// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FolderRoute from '@/views/FolderRoute.vue'
import PlaylistsView from '@/views/PlaylistsView.vue'
import PlaylistRoute from '@/views/PlaylistRoute.vue'
import HistoryView from '@/views/HistoryView.vue'
import QueueView from '@/views/QueueView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/folder/:pluginId/:path(.*)*',
      name: 'folder',
      component: FolderRoute,
      props: true,
    },
    { path: '/playlists', name: 'playlists', component: PlaylistsView },
    { path: '/playlists/:id', name: 'playlist', component: PlaylistRoute, props: true },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/queue', name: 'queue', component: QueueView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
