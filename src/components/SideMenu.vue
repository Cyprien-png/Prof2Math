<script setup lang="ts">
import { ref } from 'vue';

const isCollapsed = ref(true);

const emit = defineEmits<{
    (e: 'open-settings'): void;
}>();
</script>

<template>
    <div class="h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 relative group z-50"
        :class="isCollapsed ? 'w-16' : 'w-64'">
        <!-- Logo / Brand & Toggle -->
        <div class="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800"
            :class="isCollapsed ? 'justify-center' : 'justify-between'">

            <span v-if="!isCollapsed" class="font-bold text-xl text-blue-600 dark:text-blue-400 truncate">
                MathDown
            </span>

            <button @click="isCollapsed = !isCollapsed"
                class="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                title="Toggle Sidebar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            </button>
        </div>

        <!-- Menu Items -->
        <div class="flex-1 py-4 flex flex-col gap-2 px-2">
            <!-- Example Item -->
            <!-- <button class="...">...</button> -->
        </div>

        <!-- Bottom Actions -->
        <div class="p-2 border-t border-gray-200 dark:border-gray-800">
            <button @click="emit('open-settings')"
                class="w-full flex items-center p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                :class="isCollapsed ? 'justify-center' : 'justify-start gap-3'">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                    stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span v-if="!isCollapsed" class="whitespace-nowrap font-medium">Settings</span>
            </button>
        </div>
    </div>
</template>
