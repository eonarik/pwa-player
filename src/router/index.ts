// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FolderRoute from '@/views/FolderRoute.vue'
import PlaylistsView from '@/views/PlaylistsView.vue'
import PlaylistRoute from '@/views/PlaylistRoute.vue'
import HistoryView from '@/views/HistoryView.vue'
import QueueView from '@/views/QueueView.vue'
import DislikesView from '@/views/DislikesView.vue'
import ArtistView from '@/views/ArtistView.vue'
import AlbumView from '@/views/AlbumView.vue'

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
    { path: '/dislikes', name: 'dislikes', component: DislikesView },
    { path: '/artist/:artistName', name: 'artist', component: ArtistView, props: true },
    { path: '/artist/:artistName/:album', name: 'album', component: AlbumView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
