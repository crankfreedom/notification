<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useAppStore } from '@/stores/app';

type Project = { id: string; name: string; slug: string; status: string };
type ApiResponse<T> = { success: true; data: T } | { success: false; error: { message: string } };
const appStore = useAppStore();
const projects = ref<Project[]>([]);
const loading = ref(true);
const load = async () => {
  appStore.setApiStatus('checking');
  loading.value = true;
  try {
    const [health, response] = await Promise.all([
      fetch('/api/v1/health'),
      fetch('/api/v1/projects'),
    ]);
    appStore.setApiStatus(health.ok ? 'available' : 'unavailable');
    const body = (await response.json()) as ApiResponse<Project[]>;
    projects.value = body.success ? body.data : [];
  } catch {
    appStore.setApiStatus('unavailable');
    projects.value = [];
  } finally {
    loading.value = false;
  }
};
onMounted(load);
</script>

<template>
  <section class="panel">
    <p class="eyebrow">Phase 1</p>
    <h1>Developer Notification Hub</h1>
    <p>
      消息持久化主链路已经启用。创建项目和 API Key 后，外部服务即可向
      <code>/api/v1/messages</code> 发送消息。
    </p>
    <div class="status" :data-status="appStore.apiStatus">
      API 状态：<strong>{{ appStore.apiStatus }}</strong>
    </div>
    <button type="button" @click="load">刷新数据</button>
  </section>
  <section class="section">
    <div class="section-heading">
      <h2>Projects</h2>
      <span>{{ projects.length }}</span>
    </div>
    <p v-if="loading">正在读取项目…</p>
    <p v-else-if="!projects.length" class="muted">尚无项目。请通过 API 创建第一个 Project。</p>
    <ul v-else class="item-list">
      <li v-for="project in projects" :key="project.id">
        <strong>{{ project.name }}</strong
        ><span>{{ project.slug }} · {{ project.status }}</span>
      </li>
    </ul>
  </section>
</template>
