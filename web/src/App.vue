<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">Notification Hub</RouterLink>
      <nav aria-label="主导航">
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/messages">Messages</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
      </nav>
    </header>
    <RouterView />
  </main>
</template>
