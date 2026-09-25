// src/router/index.ts

import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import FolderRoute from '@/views/FolderRoute.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/folder/:path(.*)*',
      name: 'folder',
      component: FolderRoute,
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
