import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const apiStatus = ref<'checking' | 'available' | 'unavailable'>('checking');

  const setApiStatus = (status: typeof apiStatus.value) => {
    apiStatus.value = status;
  };

  return { apiStatus, setApiStatus };
});
