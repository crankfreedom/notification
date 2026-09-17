import { createRouter, createWebHistory } from 'vue-router';

import DashboardView from '@/views/DashboardView.vue';
import MessagesView from '@/views/MessagesView.vue';
import SettingsView from '@/views/SettingsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/messages', name: 'messages', component: MessagesView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
});
