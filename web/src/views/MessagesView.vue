<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Message = {
  id: string;
  project: { name: string };
  level: string;
  title: string;
  message: string;
  createdAt: string;
};
type Response = { success: true; data: { items: Message[]; total: number } } | { success: false };
const messages = ref<Message[]>([]);
const total = ref(0);
const loading = ref(true);
const load = async () => {
  loading.value = true;
  try {
    const body = (await (await fetch('/api/v1/messages')).json()) as Response;
    if (body.success) {
      messages.value = body.data.items;
      total.value = body.data.total;
    }
  } finally {
    loading.value = false;
  }
};
onMounted(load);
</script>

<template>
  <section class="section">
    <div class="section-heading">
      <div>
        <p class="eyebrow">History</p>
        <h1>Messages</h1>
      </div>
      <button type="button" @click="load">刷新</button>
    </div>
    <p v-if="loading">正在读取消息…</p>
    <p v-else-if="!messages.length" class="muted">
      还没有消息。通过项目 API Key 调用消息接口后，它们会显示在这里。
    </p>
    <ul v-else class="item-list message-list">
      <li v-for="item in messages" :key="item.id">
        <div>
          <span class="level" :data-level="item.level">{{ item.level }}</span
          ><strong>{{ item.title }}</strong>
          <p>{{ item.message }}</p>
        </div>
        <span>{{ item.project.name }} · {{ new Date(item.createdAt).toLocaleString() }}</span>
      </li>
    </ul>
    <p v-if="!loading" class="muted">共 {{ total }} 条消息</p>
  </section>
</template>
