import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { router } from './router';
import './styles.css';

if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');

createApp(App).use(createPinia()).use(router).mount('#app');
