<script setup lang="ts">
import LiveEditor from './components/LiveEditor.vue';
import { onMounted, onUnmounted } from 'vue';
import { activeMenuPath } from './services/MenuState';

// Global click listener to close context menus
const onGlobalClick = () => {
  activeMenuPath.value = null;
};

onMounted(() => {
  window.addEventListener('click', onGlobalClick);
});

onUnmounted(() => {
  window.removeEventListener('click', onGlobalClick);
});
</script>
<template>
  <div class="min-h-screen w-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans">
    <LiveEditor />
  </div>
</template>
