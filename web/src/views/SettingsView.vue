<script setup lang="ts">
import { computed, ref } from 'vue';

type ApiResponse<T> = { success: true; data: T } | { success: false; error: { message: string } };
const status = ref('正在检查浏览器通知支持…');
const busy = ref(false);
const supported = computed(
  () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
);
const toUint8Array = (value: string) => {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const enablePush = async () => {
  if (!supported.value) {
    status.value =
      '当前浏览器不支持 Web Push。请使用 HTTPS 环境中的最新版 Safari、Chrome 或 Edge。';
    return;
  }
  busy.value = true;
  try {
    if ((await Notification.requestPermission()) !== 'granted') {
      status.value = '未获得通知权限。请在浏览器或系统设置中允许通知后重试。';
      return;
    }
    const keyResponse = await fetch('/api/v1/push/vapid-public-key');
    const keyBody = (await keyResponse.json()) as ApiResponse<{ publicKey: string }>;
    if (!keyResponse.ok || !keyBody.success)
      throw new Error(keyBody.success ? '' : keyBody.error.message);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(keyBody.data.publicKey),
    });
    const response = await fetch('/api/v1/push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    const body = (await response.json()) as ApiResponse<{ id: string }>;
    if (!response.ok || !body.success) throw new Error(body.success ? '' : body.error.message);
    status.value = '通知已开启。下一条项目消息将发送系统提醒。';
  } catch (error) {
    status.value = error instanceof Error ? `无法开启通知：${error.message}` : '无法开启通知。';
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <section class="panel">
    <p class="eyebrow">Settings</p>
    <h1>通知设置</h1>
    <p>将 Notification Hub 安装到设备主屏幕后，可在收到项目消息时获得系统通知。</p>
    <button type="button" :disabled="busy" @click="enablePush">
      {{ busy ? '正在开启…' : '开启 Web Push 通知' }}
    </button>
    <p class="status" :data-status="supported ? 'available' : 'unavailable'">{{ status }}</p>
  </section>
</template>
