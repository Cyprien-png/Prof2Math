<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
    isOpen: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const isDark = ref(false);

const toggleDark = () => {
    isDark.value = !isDark.value;
    if (isDark.value) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
};

onMounted(() => {
    // initialize from localstorage or system pref
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDark.value = true;
        document.documentElement.classList.add('dark');
    } else {
        isDark.value = false;
        document.documentElement.classList.remove('dark');
    }
});
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- Dialog -->
        <div
            class="relative bg-white dark:bg-neutral-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-700">
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-bold text-neutral-800 dark:text-neutral-100">Settings</h2>
                <button @click="emit('close')"
                    class="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                        stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="space-y-4">
                <!-- Dark Mode Toggle -->
                <div class="flex items-center justify-between">
                    <span class="text-neutral-700 dark:text-neutral-300 font-medium">Dark Mode</span>
                    <button @click="toggleDark"
                        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        :class="isDark ? 'bg-blue-600' : 'bg-neutral-200'">
                        <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                            :class="isDark ? 'translate-x-6' : 'translate-x-1'" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
